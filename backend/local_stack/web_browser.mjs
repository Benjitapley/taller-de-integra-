import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ROOMIES_PLAYWRIGHT);
let input = "";
for await (const chunk of process.stdin) input += chunk;
const browser = await chromium.launch({ executablePath: process.env.ROOMIES_BROWSER, headless: true, args: ["--no-first-run", "--disable-background-networking"] });
try {
  const context = await browser.newContext();
  const origin = process.env.ROOMIES_WEB;
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  await context.addCookies(JSON.parse(input).cookies);
  const page = await context.newPage();
  await page.goto(origin + "/perfil");
  await page.waitForURL(origin + "/inicio");
  await page.goto(origin + "/perfil");
  await page.getByText("Información personal", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Editar perfil" }).click();
  assert.equal(await page.locator('#profile-age').getAttribute("readonly"), "");
  assert.ok(!await page.evaluate(() => document.cookie.includes("roomies_sb")));
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  for (const path of ["/mis-publicaciones", "/mis-postulaciones", "/mis-conexiones"]) {
    await page.goto(origin + path);
    await page.locator("h1").waitFor();
    assert.ok(page.url().endsWith(path));
    assert.ok(await page.locator("aside").count());
  }
  await page.goto(origin + "/admin");
  await page.getByText("Tu cuenta no tiene acceso administrativo.", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/mis-postulaciones");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  console.log("PASS navegador Next.js: perfil, edad derivada, cookies inaccesibles a JS, navegación nativa, admin restringido y móvil");
  // La renovación ocurrió en el navegador; devolver las cookies solo al driver.
  await writeFile(process.env.ROOMIES_BROWSER_COOKIES, JSON.stringify(await context.cookies()), { mode: 0o600 });
} finally { await browser.close(); }
