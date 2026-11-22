import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

/** Optional browser check against proxy.test.mjs's isolated server and public catalog doubles. */
export async function publicationsBrowser({ base, cookie, playwrightPath, browserPath }) {
  if (!playwrightPath || !browserPath) throw new Error("Explicit local Playwright and browser paths required");
  const sql = await readFile(new URL("../../backend/services/listado-applications-service/migrations/003_catalogo_cut.up.sql", import.meta.url), "utf8");
  const communes = [...sql.matchAll(/^\((\d+),9,'((?:[^']|'')*)'\)/gm)].map(match => ({ id_comuna: Number(match[1]), id_region: 9, nombre: match[2].replaceAll("''", "'") }));
  assert.equal(communes.length, 32);
  const selected = communes.find(item => item.nombre === "Padre Las Casas");
  assert.ok(selected);
  const { chromium } = createRequire(import.meta.url)(playwrightPath);
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-proxy-server"] });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const errors = [];
  const keys = [];
  let failure = "regions";
  try {
    await context.addCookies([{ name: "haycupo_dev_session", value: cookie.split("=")[1], url: base, httpOnly: true, sameSite: "Strict" }]);
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/regiones", route => route.fulfill({ status: failure === "regions" ? 503 : 200, contentType: "application/json", body: JSON.stringify([{ id_region: 13, nombre: "Metropolitana de Santiago" }, { id_region: 9, nombre: "La Araucanía" }]) }));
    await page.route("**/api/regiones/9/comunas", route => route.fulfill({ status: failure === "communes" ? 503 : 200, contentType: "application/json", body: JSON.stringify(communes) }));
    await page.goto(`${base}/publicar`);
    await page.getByRole("button", { name: "Continuar →", exact: true }).click();
    const region = page.getByLabel("Región", { exact: true });
    assert.equal(await region.inputValue(), "La Araucanía");
    assert.equal(await region.getAttribute("readonly"), "");
    const commune = page.getByLabel("Comuna de La Araucanía");
    await page.getByRole("alert").filter({ hasText: "No se pudieron cargar las comunas" }).waitFor();
    assert.equal(await commune.isDisabled(), true);
    failure = "communes";
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "No se pudieron cargar las comunas" }).waitFor();
    failure = "";
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await commune.getByRole("option", { name: "Temuco", exact: true }).waitFor({ state: "attached" });
    assert.equal(await commune.locator("option").count(), 33);
    await commune.selectOption(String(selected.id_comuna));
    const location = await page.locator("form").evaluate(form => {
      const values = new FormData(form);
      return { region: values.get("id_region"), commune: values.get("id_comuna") };
    });
    assert.deepEqual(location, { region: "9", commune: String(selected.id_comuna) });
    await page.getByLabel("Título", { exact: true }).fill("Aviso de prueba local");
    await page.getByLabel("Tipo de vivienda").selectOption("habitacion");
    await page.getByLabel("Dirección o sector", { exact: true }).fill("Centro");
    await page.getByLabel("Precio del arriendo (CLP)", { exact: true }).fill("999999999999");
    await page.getByLabel("Capacidad total del espacio", { exact: true }).fill("2");
    await page.getByLabel("Descripción", { exact: true }).fill("Descripción de prueba local");
    await page.route("**/web-api/publicaciones", async route => {
      keys.push((await route.request().allHeaders())["idempotency-key"]);
      const body = route.request().postDataBuffer().toString();
      assert.match(body, /name="id_region"\r\n\r\n9\r\n/);
      assert.match(body, new RegExp(`name="id_comuna"\\r\\n\\r\\n${selected.id_comuna}\\r\\n`));
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Servicio temporalmente no disponible" }) });
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Servicio temporalmente no disponible" }).waitFor();
      assert.equal(await commune.inputValue(), String(selected.id_comuna));
    }
    assert.equal(keys.length, 2);
    assert.ok(keys[0]);
    assert.equal(keys[0], keys[1]);
    await page.route("**/web-api/publicaciones/42", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id_publicacion: 42, id_region: 9, id_comuna: selected.id_comuna, titulo: "Publicación existente", categoria: "ofrezco", tipo: "Arrendador", tipo_vivienda: "habitacion", precio: 150000, ubicacion: "Centro", cupos_totales: 2, mascota: "no", descripcion: "Detalle existente", imagenes: [], reglas: ["Sin humo"] }) }));
    await page.goto(`${base}/editar-publicacion?id=42`);
    await page.getByLabel("Comuna de La Araucanía").getByRole("option", { name: "Temuco", exact: true }).waitFor({ state: "attached" });
    assert.equal(await page.getByLabel("Región", { exact: true }).inputValue(), "La Araucanía");
    assert.equal(await page.getByLabel("Comuna de La Araucanía").inputValue(), String(selected.id_comuna));
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
}
