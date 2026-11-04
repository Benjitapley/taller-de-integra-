import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/features/auth/validation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { validateAuth, validateVerification } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const today = new Date(2026, 9, 24, 12);
// Solo entradas de funciones puras. No se crean cuentas ni sesiones.
const valid = { nombre: "Nombre de validación", correo: "validacion@example.com", contrasena: " abcde", fecha_nacimiento: "2000-01-01" };

test("login exige correo y contraseña, sin exigir campos de registro", () => {
  assert.deepEqual(validateAuth("login", { nombre: "", correo: "", contrasena: "", fecha_nacimiento: "" }, today), { correo: "Ingresa tu correo electrónico.", contrasena: "Ingresa tu contraseña." });
  assert.deepEqual(validateAuth("login", { ...valid, nombre: "", contrasena: "a", fecha_nacimiento: "" }, today), {});
});
test("registro exige todos los campos", () => {
  assert.deepEqual(Object.keys(validateAuth("register", { nombre: "  ", correo: "  ", contrasena: "", fecha_nacimiento: "" }, today)).sort(), ["contrasena", "correo", "fecha_nacimiento", "nombre"]);
});
test("correo valida formato y permite espacios externos y alias", () => {
  for (const correo of ["texto", "a@", "@dominio.cl", "a b@dominio.cl", "a@@dominio.cl", "a@dominio", "a@dominio."]) assert.ok(validateAuth("login", { ...valid, correo }, today).correo, correo);
  for (const correo of ["  persona+alias@sub.dominio.cl  ", "a@example.com"]) assert.equal(validateAuth("login", { ...valid, correo }, today).correo, undefined);
});
test("contraseña de registro admite seis caracteres exactos sin recortar ni mutar", () => {
  assert.ok(validateAuth("register", { ...valid, contrasena: "12345" }, today).contrasena);
  const values = Object.freeze({ ...valid });
  assert.deepEqual(validateAuth("register", values, today), {});
  assert.equal(values.contrasena, " abcde");
});
test("mayoría de edad: cumpleaños 18 hoy, mañana y ayer", () => {
  assert.equal(validateAuth("register", { ...valid, fecha_nacimiento: "2008-10-24" }, today).fecha_nacimiento, undefined);
  assert.ok(validateAuth("register", { ...valid, fecha_nacimiento: "2008-10-25" }, today).fecha_nacimiento);
  assert.equal(validateAuth("register", { ...valid, fecha_nacimiento: "2008-10-23" }, today).fecha_nacimiento, undefined);
});
test("rechaza fechas futuras, imposibles y formatos no ISO", () => {
  for (const fecha_nacimiento of ["2026-10-25", "2027-01-01", "2000-02-30", "2001-02-29", "2000-13-01", "2000-01-00", "0000-01-01", "24/10/2000", "2000-1-1"]) assert.ok(validateAuth("register", { ...valid, fecha_nacimiento }, today).fecha_nacimiento, fecha_nacimiento);
  assert.equal(validateAuth("register", { ...valid, fecha_nacimiento: "2000-02-29" }, today).fecha_nacimiento, undefined);
});
test("nacidos el 29 de febrero cumplen años el 1 de marzo en año no bisiesto, igual que el backend actual", () => {
  assert.ok(validateAuth("register", { ...valid, fecha_nacimiento: "2008-02-29" }, new Date(2026, 1, 28)).fecha_nacimiento);
  assert.equal(validateAuth("register", { ...valid, fecha_nacimiento: "2008-02-29" }, new Date(2026, 2, 1)).fecha_nacimiento, undefined);
});

test("verificación exige correo y código", () => {
  assert.deepEqual(Object.keys(validateVerification({ correo: "", codigo: "" })), ["correo", "codigo"]);
  assert.ok(validateVerification({ correo: "no-es-correo", codigo: "123456" }).correo);
});
test("código exige exactamente seis dígitos ASCII", () => {
  for (const codigo of ["12345", "1234567", "12a456", "123 56", " 123456", "123456 ", "１２３４５６", "١٢٣٤٥٦", "12345\n", "123456\n"]) {
    assert.ok(validateVerification({ correo: valid.correo, codigo }).codigo, JSON.stringify(codigo));
  }
});
test("código admite ceros iniciales y todos ceros sin acreditar verificación", () => {
  for (const codigo of ["012345", "000000", "123456"]) {
    const values = Object.freeze({ correo: valid.correo, codigo });
    assert.deepEqual(validateVerification(values), {});
    assert.equal(values.codigo, codigo);
  }
});
test("reenvío valida solo correo aunque el código esté vacío o sea inválido", () => {
  for (const codigo of ["", "incorrecto"]) assert.deepEqual(validateVerification({ correo: valid.correo, codigo }, "resend"), {});
  assert.deepEqual(Object.keys(validateVerification({ correo: "", codigo: "" }, "resend")), ["correo"]);
  assert.ok(validateVerification({ correo: "incorrecto", codigo: "123456" }, "resend").correo);
});

const navigationSource = await readFile(new URL("../src/config/navigation.ts", import.meta.url), "utf8");
const { outputText: navigationJs } = ts.transpileModule(navigationSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { routes, authFlowLinks } = await import(`data:text/javascript;base64,${Buffer.from(navigationJs).toString("base64")}`);

test("login y registro permiten ir explícitamente a verificar", () => {
  assert.equal(routes.verify, "/verificar");
  for (const screen of ["login", "register"]) assert.ok(authFlowLinks[screen].some(({ href }) => href === routes.verify));
});
test("verificación permite volver a login o registro sin destino de sesión", () => {
  assert.deepEqual(authFlowLinks.verify.map(({ href }) => href), [routes.access, routes.register]);
  for (const links of Object.values(authFlowLinks)) {
    for (const { href } of links) {
      assert.ok(["/", "/registro", "/verificar"].includes(href));
      assert.equal(href.includes("?"), false, "no propagar correo, código o credenciales en URL");
    }
  }
});
