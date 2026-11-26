/** Navegador real contra BFF/Gateway/servicios/SQL reales; identidad ficticia explícita. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(new URL("../../frontend-next/package.json", import.meta.url));
const { chromium } = require("playwright");
let input = "";
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const browserPath = process.env.E03_BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch({ headless: true, ...(existsSync(browserPath) ? { executablePath: browserPath } : {}) });
const cases = [];
const contexts = [];
const exceptions = [];
const pass = name => { cases.push({ name, result: "passed" }); console.log("PASS", name); };
const headers = { Origin: config.origin, "X-Haycupo-CSRF": "1" };
const messagesPath = `/web-api/conversaciones/${config.conversation}/mensajes`;
const apiPath = `/api/conversaciones/${config.conversation}/mensajes`;
const waitUntil = async (operation, description) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await operation()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error("Timeout: " + description);
};
async function login(context, person) {
  const result = await context.request.post(config.origin + "/web-api/auth/login", {
    headers, data: { correo: person.correo, contrasena: person.contrasena },
  });
  assert.equal(result.status(), 200, "Login por BFF con identidad de contrato");
}
async function openChat(page) {
  await page.goto(config.origin + "/mi-arriendo/chat");
  await page.getByRole("button", { name: "Enviar mensaje" }).waitFor();
  await waitUntil(() => page.locator('[role="log"] article').count().then(n => n > 0), "historial inicial");
}
async function send(page, text) {
  await page.getByLabel("Escribe un mensaje").fill(text);
  const response = page.waitForResponse(r => r.url().endsWith(messagesPath) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  assert.equal((await response).status(), 200);
  await page.getByRole("log").getByText(text, { exact: true }).waitFor();
  await page.getByText("Enviando…", { exact: true }).waitFor({ state: "hidden" });
}
async function denied(context) {
  const cookies = await context.cookies();
  const token = cookies.find(cookie => cookie.name === "roomies_sb_dev_access").value;
  for (const method of ["GET", "POST"]) {
    const data = { contenido: "Acceso prohibido", id_cliente: crypto.randomUUID() };
    const bff = await context.request.fetch(config.origin + messagesPath, {
      method, headers, ...(method === "POST" ? { data } : {}),
    });
    assert.equal(bff.status(), 403);
    assert.match(bff.headers()["cache-control"], /no-store/);
    const direct = await context.request.fetch(config.gateway + apiPath, {
      method, headers: { Authorization: "Bearer " + token }, ...(method === "POST" ? { data } : {}),
    });
    assert.equal(direct.status(), 403);
  }
}
try {
  await mkdir(config.evidence, { recursive: true });
  for (const person of config.people) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
    contexts.push(context);
    await login(context, person);
  }
  const [first, second, owner, third] = contexts;
  const page = await first.newPage();
  const other = await second.newPage();
  for (const tab of [page, other]) tab.on("pageerror", e => exceptions.push(e.message));
  await openChat(page);
  await openChat(other);
  await send(page, "Mensaje de integrante A");
  await send(other, "Mensaje de integrante B");
  for (const tab of [page, other]) {
    await tab.reload();
    await tab.getByRole("log").getByText("Mensaje de integrante A", { exact: true }).waitFor();
    await tab.getByRole("log").getByText("Mensaje de integrante B", { exact: true }).waitFor();
  }
  pass("dos integrantes: envío, F5 y persistencia compartida");

  const ownArticle = page.locator('article').filter({ hasText: "Mensaje de integrante A" });
  const foreignArticle = page.locator('article').filter({ hasText: "Mensaje de integrante B" });
  assert.match(await ownArticle.getAttribute("class"), /ownMessage/);
  assert.doesNotMatch(await foreignArticle.getAttribute("class"), /ownMessage/,
    "Dos personas con el mismo nombre no son el mismo emisor");
  pass("identidad de emisor por ID, incluso con nombres iguales");
  await page.screenshot({ path: join(config.evidence, "chat-dos-integrantes.png"), fullPage: true });

  const log = page.getByRole("log");
  while (await page.getByRole("button", { name: "Cargar mensajes anteriores", exact: true }).count()) {
    await log.evaluate(element => { element.scrollTop = 0; });
    const before = await log.evaluate(element => ({
      top: element.scrollTop, height: element.scrollHeight,
      key: element.querySelector("article p").textContent,
      y: element.querySelector("article").getBoundingClientRect().top,
    }));
    await page.getByRole("button", { name: "Cargar mensajes anteriores", exact: true }).click();
    await page.getByRole("button", { name: "Cargando…", exact: true }).waitFor({ state: "hidden" });
    await waitUntil(() => log.evaluate(element => element.scrollHeight).then(h => h > before.height), "página anterior");
    const afterY = await log.locator("article").filter({ has: page.getByText(before.key, { exact: true }) })
      .evaluate(element => element.getBoundingClientRect().top);
    assert.ok(Math.abs(afterY - before.y) < 3, "La posición de lectura se conserva");
  }
  const content = await log.locator("article p").allTextContents();
  assert.equal(content.length, 47);
  assert.equal(new Set(content).size, content.length);
  assert.equal(content.includes("PREINGRESO NO VISIBLE"), false);
  assert.deepEqual(content.slice(0, 45), Array.from({ length: 45 }, (_, i) => `Historial E03 ${String(i).padStart(2, "0")}`));
  pass("tres páginas: orden, sin duplicados, ingreso y posición de lectura");

  await page.getByLabel("Escribe un mensaje").fill("   ");
  assert.equal(await page.getByRole("button", { name: "Enviar mensaje" }).isDisabled(), true);
  await page.getByLabel("Escribe un mensaje").clear();
  assert.equal(await page.getByLabel("Escribe un mensaje").getAttribute("maxlength"), "2000");
  for (const contenido of ["", "   ", "x".repeat(2001)]) {
    assert.equal((await first.request.post(config.origin + messagesPath, {
      headers, data: { contenido, id_cliente: crypto.randomUUID() },
    })).status(), 422);
  }
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(config.origin + messagesPath)).status(), 401);
  assert.equal((await anonymous.request.get(config.gateway + apiPath)).status(), 401);
  await anonymous.close();
  const privatePage = await first.request.get(config.origin + messagesPath);
  assert.match(privatePage.headers()["cache-control"], /no-store/);
  assert.match(privatePage.headers().vary, /Cookie/);
  pass("límites de texto, sesión obligatoria y respuestas privadas sin caché");

  let lost = false;
  const sentBodies = [];
  const loseResponse = async route => {
    if (route.request().method() !== "POST") return route.continue();
    sentBodies.push(route.request().postDataJSON());
    const response = await route.fetch(); // El commit ocurrió en el servicio/SQL reales.
    if (!lost) { lost = true; return route.abort("connectionreset"); }
    return route.fulfill({ response });
  };
  await page.route("**/web-api/conversaciones/*/mensajes", loseResponse);
  await page.getByLabel("Escribe un mensaje").fill("Mensaje persistido tras respuesta perdida");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await page.getByText("No enviado", { exact: true }).waitFor();
  await page.screenshot({ path: join(config.evidence, "envio-reintentable.png"), fullPage: true });
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await page.getByText("No enviado", { exact: true }).waitFor({ state: "hidden" });
  await page.getByText("Enviando…", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(sentBodies.length, 2);
  assert.deepEqual(sentBodies[0], sentBodies[1]);
  await page.unroute("**/web-api/conversaciones/*/mensajes", loseResponse);
  const conflict = await first.request.post(config.origin + messagesPath, {
    headers, data: { ...sentBodies[0], contenido: "Contenido distinto" },
  });
  assert.equal(conflict.status(), 409);
  await page.reload();
  await page.getByText("Mensaje persistido tras respuesta perdida", { exact: true }).waitFor();
  assert.equal(await page.getByText("Mensaje persistido tras respuesta perdida", { exact: true }).count(), 1);
  pass("respuesta perdida después del commit: UUID conservado, sin duplicado y conflicto 409");

  for (const context of [owner, third]) {
    await denied(context);
  }
  pass("tercero y dueño no residente: GET/POST denegados en BFF y Gateway");

  const beforeRemoval = await second.request.get(config.origin + messagesPath);
  assert.equal(beforeRemoval.status(), 200);
  const removal = await owner.request.post(config.origin + `/web-api/arriendos/${config.rental}/expulsiones`, {
    headers, data: { id_usuario: config.users[1], motivo: "Retiro de prueba E03", confirmo: true },
  });
  assert.equal(removal.status(), 200);
  await other.evaluate(() => window.dispatchEvent(new Event("focus")));
  await other.getByText(/^Acceso (retirado|no disponible)$/).waitFor();
  assert.equal(await other.getByRole("log").count(), 0);
  await denied(second);
  for (const method of ["GET", "POST"]) {
    const response = await second.request.fetch(config.origin + messagesPath, {
      method, headers, ...(method === "POST" ? { data: sentBodies[0] } : {}),
    });
    assert.equal(response.status(), 403);
  }
  await other.screenshot({ path: join(config.evidence, "acceso-retirado.png"), fullPage: true });
  pass("retiro HTTP por dueño: revocación de lectura/envío y limpieza visual");

  // Retrasar una respuesta REAL ya autorizada; cambiar luego a una cuenta sin acceso.
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let captured = false;
  const delayResponse = async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    captured = true;
    await held;
    await route.fulfill({ response }).catch(() => {}); // La navegación puede abortar la petición.
  };
  await page.route("**/web-api/conversaciones/*/mensajes?*", delayResponse);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await waitUntil(() => captured, "respuesta real retenida");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("roomies:session-change", { detail: "start" })));
  await login(first, config.people[3]);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("roomies:session-change", { detail: "complete" })));
  release();
  await page.getByText(/^Acceso (retirado|no disponible)$/).waitFor();
  assert.equal(await page.getByRole("log").count(), 0);
  assert.equal(await page.getByText("Mensaje de integrante A", { exact: true }).count(), 0);
  await page.unroute("**/web-api/conversaciones/*/mensajes?*", delayResponse);
  pass("cambio de cuenta con respuesta tardía: sin mensajes ni borrador anteriores");

  await login(first, config.people[0]);
  await openChat(page);
  assert.deepEqual(exceptions, []);
  pass("navegador sin excepciones JavaScript");
} finally {
  await writeFile(join(config.evidence, "browser.json"), JSON.stringify({
    identity: "fixture GoTrue/JWKS; no Supabase", cases,
  }, null, 2) + "\n");
  for (const context of contexts) await context.close();
  await browser.close();
}
