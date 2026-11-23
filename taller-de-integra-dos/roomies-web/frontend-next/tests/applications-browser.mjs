import assert from "node:assert/strict";
import { createRequire } from "node:module";

const initial = { id_postulacion: 8, id_publicacion: 7, id_usuario: 2, titulo: "Aviso privado de prueba", estado: "Preseleccionada", id_arriendo: null, incorporacion_pendiente: false };

/** HTTP contract double for proxy.test.mjs; no database, identity provider or admission service. */
export function createApplicationsFixture() {
  let current = { ...initial };
  let behavior = "lost";
  let pageFailed = false;
  const keys = [];
  return {
    keys,
    setBehavior(value) { behavior = value; },
    reset(value) { behavior = value; current = { ...initial }; keys.length = 0; pageFailed = false; },
    async handle(request, response, url) {
      if (!["/api/publicaciones/7/postulantes", "/api/postulaciones/mias", "/api/postulaciones/8", "/api/postulaciones/8/estado"].includes(url.pathname)) return false;
      assert.match(request.headers.authorization ?? "", /^Bearer fixture\./);
      assert.equal(request.headers.cookie, undefined);
      response.setHeader("Content-Type", "application/json");
      if (request.method === "GET") {
        if (behavior === "pages" && url.pathname.endsWith("/postulantes")) {
          const start = url.searchParams.get("cursor") === "page_20" ? 20 : url.searchParams.get("cursor") === "page_40" ? 40 : 0;
          if (start === 20 && !pageFailed) {
            pageFailed = true; response.statusCode = 503;
            response.end(JSON.stringify({detail:"private-service-error"})); return true;
          }
          const rows = Array.from({length:41},(_,index)=>({...initial,id_postulacion:index+100,estado:"Pendiente"}));
          response.end(JSON.stringify({items:rows.slice(start,start+20),siguiente_cursor:start+20<41?`page_${start+20}`:null}));
          return true;
        }
        if (url.pathname === "/api/postulaciones/8" && behavior === "forbidden") {
          response.statusCode = 403;
          response.end(JSON.stringify({ detail: "private-service-error" }));
        } else response.end(JSON.stringify(url.pathname === "/api/postulaciones/8" ? current : [current]));
        return true;
      }
      assert.equal(request.method, "PATCH");
      assert.equal(url.pathname, "/api/postulaciones/8/estado");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), { estado: "Aceptada" });
      const key = request.headers["idempotency-key"];
      assert.match(key, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
      keys.push(key);
      current = { ...initial, incorporacion_pendiente: true, operacion: { id_operacion: key, estado: "Pendiente" } };
      if (behavior === "lost") { response.destroy(); return true; }
      if (behavior === "pending") response.statusCode = 202;
      else if (behavior === "conflict") {
        current = { ...initial, operacion: { id_operacion: key, estado: "Rechazada", codigo_error: "SIN_CUPOS" } };
        response.statusCode = 409;
        response.end(JSON.stringify({ detail: "private-service-error" }));
        return true;
      } else current = { ...initial, estado: "Aceptada", id_arriendo: 12, incorporacion_pendiente: false, operacion: { id_operacion: key, estado: "Confirmada" } };
      response.end(JSON.stringify(current));
      return true;
    },
  };
}

export async function applicationsBrowser({ base, cookie, fixture, playwrightPath, browserPath }) {
  if (!playwrightPath || !browserPath) throw new Error("Explicit local Playwright and browser paths required");
  const { chromium } = createRequire(import.meta.url)(playwrightPath);
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-proxy-server"] });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const errors = [];
  try {
    await context.addCookies([{ name: "haycupo_dev_session", value: cookie.split("=")[1], url: base, httpOnly: true, sameSite: "Strict" }]);
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/postulantes/7`);
    const accept = page.getByRole("button", { name: "Aceptar postulación", exact: true });
    await accept.waitFor();
    await accept.evaluate(button => { button.click(); button.click(); });
    await page.getByRole("status").filter({ hasText: "La incorporación al arriendo aún no está confirmada" }).waitFor();
    await page.getByRole("button", { name: "Reintentar aceptación", exact: true }).waitFor({ state: "visible" });
    assert.equal(fixture.keys.length, 1, "rapid clicks send a single admission command");
    assert.equal(await page.getByText("Aceptada", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Abrir Mi arriendo", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Rechazar postulación", exact: true }).isDisabled(), true);
    const originalKey = fixture.keys[0];

    // Reload discards React memory; the authorized GET recovers the durable operation key.
    await page.reload();
    const retry = page.getByRole("button", { name: "Reintentar aceptación", exact: true });
    await retry.waitFor();
    fixture.setBehavior("confirm");
    await retry.click();
    await page.getByText("Aceptada", { exact: true }).waitFor();
    assert.deepEqual(fixture.keys, [originalKey, originalKey]);
    assert.equal(await page.getByRole("button", { name: "Aceptar postulación", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Rechazar postulación", exact: true }).count(), 0);
    await page.goto(`${base}/mis-postulaciones`);
    await page.getByRole("link", { name: "Abrir Mi arriendo", exact: true }).waitFor();

    fixture.reset("conflict");
    await page.goto(`${base}/postulantes/7`);
    await accept.click();
    await page.getByText("La incorporación no se completó. La postulación sigue preseleccionada.", { exact: true }).waitFor();
    assert.equal(await page.getByText("Aceptada", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Rechazar postulación", exact: true }).isEnabled(), true);
    fixture.setBehavior("confirm");
    await retry.click();
    await page.getByText("Aceptada", { exact: true }).waitFor();
    assert.equal(fixture.keys.length, 2);
    assert.notEqual(fixture.keys[0], fixture.keys[1], "a terminal conflict requires an explicit new attempt");

    fixture.reset("pending");
    await page.goto(`${base}/postulantes/7`);
    await accept.click();
    await page.getByRole("button", { name: "Consultar estado", exact: true }).waitFor();
    fixture.setBehavior("forbidden");
    await page.getByRole("button", { name: "Consultar estado", exact: true }).click();
    await page.getByText("No hay postulaciones para mostrar.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Postulación 8", exact: true }).count(), 0);
    assert.equal(await retry.count(), 0);
    assert.doesNotMatch(await page.locator("main").innerText(), /private-service-error/);
    assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), { local: {}, session: {} });
    fixture.reset("pages");
    await page.goto(`${base}/postulantes/7`);
    await page.getByRole("heading",{name:"Postulación 119",exact:true}).waitFor();
    const more=page.getByRole("button",{name:"Cargar más postulaciones",exact:true});
    await more.click();
    await page.getByRole("button",{name:"Reintentar carga",exact:true}).waitFor();
    assert.equal(await page.getByRole("heading",{name:/^Postulación \d+$/}).count(),20);
    await page.getByRole("button",{name:"Reintentar carga",exact:true}).click();
    await page.getByRole("heading",{name:"Postulación 139",exact:true}).waitFor();
    await more.click();
    await page.getByRole("heading",{name:"Postulación 140",exact:true}).waitFor();
    assert.equal(await page.getByRole("heading",{name:/^Postulación \d+$/}).count(),41);
    assert.equal(await more.count(),0);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
}
