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
// A valid one-pixel PNG keeps the browser check independent of repository assets.
  const photo = name => ({
    name, mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNYEKABAAKsARm/+uplAAAAAElFTkSuQmCC", "base64"),
  });
  const errors = [];
  const keys = [];
  let failure = "regions";
  try {
    await context.addCookies([{ name: "haycupo_dev_session", value: cookie.split("=")[1], url: base, httpOnly: true, sameSite: "Strict" }]);
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(30_000);
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
    await page.getByLabel("Tipo de vivienda").selectOption("Habitacion");
    await page.getByLabel("Precio del arriendo (CLP)", { exact: true }).fill("999999999999");
    await page.getByLabel("Capacidad total", { exact: true }).fill("2");
    await page.getByLabel("Descripción", { exact: true }).fill("Descripción de prueba local");
    const images = page.getByLabel("Fotografías (hasta 5 en total)");
    await images.setInputFiles(photo("pieza.png"));
    await images.setInputFiles(photo("entrada.png"));
    await page.getByRole("img", { name: "Vista previa 2" }).waitFor();
    assert.equal(await page.getByRole("img", { name: "Vista previa 1" }).evaluate(image => image.decode().then(() => image.naturalWidth)), 1);
    await page.getByLabel("Regla 1", { exact: true }).fill("Sin humo");
    await page.getByRole("button", { name: "Agregar regla", exact: true }).click();
    await page.getByLabel("Regla 2", { exact: true }).fill("Respetar horarios");
    await page.getByRole("button", { name: "Vista previa", exact: true }).click();
    await page.getByRole("region", { name: "Vista previa del aviso" }).getByRole("heading", { name: "Aviso de prueba local" }).waitFor();
    await page.route("**/web-api/publicaciones", async route => {
      keys.push((await route.request().allHeaders())["idempotency-key"]);
      const request = route.request();
      const contentType = (await request.allHeaders())["content-type"];
      assert.match(contentType, /^multipart\/form-data; boundary=.+/);
      const form = await new Response(request.postDataBuffer(), { headers: { "content-type": contentType } }).formData();
      assert.equal(form.get("tipo"), "Arrendador");
      assert.equal(form.get("precio"), "999999999999");
      assert.deepEqual(JSON.parse(form.get("reglas_arrendador")), ["Sin humo", "Respetar horarios"]);
      assert.deepEqual(form.getAll("imagenes").map(file => file.name), ["pieza.png", "entrada.png"]);
      const body = request.postDataBuffer().toString();
      assert.match(body, /name="id_region"\r\n\r\n9\r\n/);
      assert.match(body, new RegExp(`name="id_comuna"\\r\\n\\r\\n${selected.id_comuna}\\r\\n`));
      if (keys.length === 3) return route.fulfill({ status: 201, json: { id_publicacion: 4242 } });
      return route.fulfill({ status: 503, json: { detail: "Servicio temporalmente no disponible" } });
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Servicio temporalmente no disponible" }).waitFor();
      assert.equal(await commune.inputValue(), String(selected.id_comuna));
      assert.deepEqual(await images.evaluate(input => [...input.files].map(file => file.name)), ["pieza.png", "entrada.png"]);
      await page.getByRole("img", { name: "Vista previa 2" }).waitFor();
    }
    assert.equal(keys.length, 2);
    assert.ok(keys[0]);
    assert.equal(keys[0], keys[1]);
    await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
    await page.getByRole("heading", { name: "Aviso guardado con formato canónico" }).waitFor();
    await page.getByText("Arrendadora de prueba", { exact: true }).waitFor();
    await page.getByText("Sin humo", { exact: true }).waitFor();
    assert.equal(keys[0], keys[2]);

    let edits = 0;
    const existing = {
      id_publicacion: 42, region: { id: 9, nombre: "La Araucanía" },
      comuna: { id: selected.id_comuna, nombre: selected.nombre }, titulo: "Publicación existente",
      estado: "Disponible", tipo: "Arrendador", tipo_vivienda: "Habitacion", precio: 999999999999,
      ubicacion: "Centro", cupos_totales: 2, mascota: "no", descripcion: "Detalle existente",
      imagenes: [{ id_imagen: 11 }, { id_imagen: 12 }], reglas_arrendador: ["Sin humo"],
    };
    await page.route("**/web-api/publicaciones/42", async route => {
      const request = route.request();
      if (request.method() === "GET") return route.fulfill({ json: existing });
      assert.equal(request.method(), "PUT");
      edits++;
      const form = await new Response(request.postDataBuffer(), {
        headers: { "content-type": (await request.allHeaders())["content-type"] },
      }).formData();
      assert.equal(form.get("imagenes_conservar"), "[11]");
      assert.deepEqual(form.getAll("imagenes").map(file => file.name), ["nueva.png"]);
      assert.equal(form.get("cupos_totales"), "1");
      assert.deepEqual(JSON.parse(form.get("reglas_arrendador")), ["Respetar horarios"]);
      assert.equal(form.get("precio"), "999999999999");
      return route.fulfill({ status: 409, json: { detail: "Capacidad inferior a los integrantes activos" } });
    });
    await page.goto(`${base}/editar-publicacion?id=42`);
    await page.getByLabel("Comuna de La Araucanía").getByRole("option", { name: "Temuco", exact: true }).waitFor({ state: "attached" });
    assert.equal(await page.getByLabel("Región", { exact: true }).inputValue(), "La Araucanía");
    assert.equal(await page.getByLabel("Comuna de La Araucanía").inputValue(), String(selected.id_comuna));
    assert.equal(await page.getByLabel("Precio del arriendo (CLP)", { exact: true }).inputValue(), "999999999999");
    const removed = page.getByRole("checkbox", { name: "Conservar imagen" }).nth(1);
    await removed.uncheck();
    await images.setInputFiles(photo("nueva.png"));
    const rules = page.getByLabel("Regla 1", { exact: true });
    assert.equal(await rules.inputValue(), "Sin humo");
    await rules.fill("Respetar horarios");
    await page.getByLabel("Capacidad total", { exact: true }).fill("1");
    assert.equal(edits, 0);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.getByRole("alert").filter({ hasText: "Capacidad inferior a los integrantes activos" }).waitFor();
    assert.equal(edits, 1);
    assert.equal(await removed.isChecked(), false);
    assert.deepEqual(await images.evaluate(input => [...input.files].map(file => file.name)), ["nueva.png"]);
    await page.getByRole("img", { name: "Vista previa 1" }).waitFor();
    const catalogRequests = [];
    const publication = (id, title, available) => ({
      id_publicacion: id, titulo: title, precio: 150000, ubicacion: "Temuco", tipo: "Arrendador",
      tipo_vivienda: "habitacion", categoria: "ofrezco", cupos_totales: available,
      cupos_disponibles: available, imagenes: [], descripcion: "Fixture local", mascota: "no", estado: "Disponible",
    });
    await page.route("**/api/publicaciones**", async route => {
      const requestUrl = new URL(route.request().url());
      catalogRequests.push(requestUrl);
      const cursor = requestUrl.searchParams.get("cursor");
      const available = requestUrl.searchParams.get("cupos_disponibles");
      const data = { items: [], siguiente_cursor: null };
      if (available === "2") data.items.push(publication(3, "Aviso con exactamente dos cupos", 2));
      else if (available === null && cursor === null) {
        data.items.push(publication(1, "Aviso página uno", 3));
        data.siguiente_cursor = "cursor-page-two";
      } else if (available === null && cursor === "cursor-page-two") {
        data.items.push(publication(2, "Aviso página dos", 1));
        data.siguiente_cursor = "cursor-page-three";
      } else if (available === null && cursor === "cursor-page-three") {
        data.items.push(publication(3, "Aviso con exactamente dos cupos", 2));
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(`${base}/inicio`);
    await page.getByRole("heading", { name: "Aviso página uno" }).waitFor();
    await page.getByRole("button", { name: "Cargar más" }).click();
    await page.getByRole("heading", { name: "Aviso página dos" }).waitFor();
    assert.ok(catalogRequests.some(url => url.searchParams.get("cursor") === "cursor-page-two"));

    await page.getByRole("button", { name: "Cargar más" }).click();
    await page.getByRole("heading", { name: "Aviso con exactamente dos cupos" }).waitFor();
    await page.getByText("No hay más publicaciones.").waitFor();
    assert.ok(catalogRequests.some(url => url.searchParams.get("cursor") === "cursor-page-three"));

    const capacityFilter = page.getByRole("spinbutton", { name: "Cupos exactos" });
    await capacityFilter.fill("2");
    await page.getByRole("combobox", { name: "Región para buscar" }).selectOption("9");
    await page.getByRole("combobox", { name: "Comuna para buscar" }).selectOption(String(selected.id_comuna));
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByText("1 resultados", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Aviso con exactamente dos cupos" }).waitFor();
    const filteredUrl = catalogRequests.find(url => url.searchParams.get("cupos_disponibles") === "2");
    assert.ok(filteredUrl);
    assert.equal(filteredUrl.searchParams.get("cursor"), null, "cambiar el filtro inicia desde la primera página");
    assert.equal(await page.getByRole("heading", { name: "Aviso página uno" }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Aviso página dos" }).count(), 0);
    assert.equal(filteredUrl.searchParams.has("cupos_min"), false);
    assert.equal(filteredUrl.searchParams.get("id_region"), "9");
    assert.equal(filteredUrl.searchParams.get("id_comuna"), String(selected.id_comuna));
    await capacityFilter.fill("5");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByText("No hay publicaciones para estos filtros").waitFor();
    assert.ok(catalogRequests.some(url => url.searchParams.get("cupos_disponibles") === "5"));

    await page.goto(base + "/mis-publicaciones");
    await page.getByRole("heading", { name: "Aviso guardado con formato canónico" }).waitFor();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Cerrar publicación" }).click();
    await page.getByText("Cerrada", { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Cerrar publicación" }).isDisabled(), true);
    const filtered = page.waitForRequest(request =>
      new URL(request.url()).pathname === "/web-api/mis-publicaciones" && new URL(request.url()).searchParams.get("estado") === "Cerrada");
    await page.getByRole("combobox", { name: "Estado" }).selectOption("Cerrada");
    await filtered;
    await page.getByRole("heading", { name: "Aviso guardado con formato canónico" }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
}
