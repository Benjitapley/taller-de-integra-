import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function cargar(nombre, dependencias = {}) {
  const fuente = readFileSync(new URL("../src/" + nombre + ".ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, FormData, URL, require: id => dependencias[id] });
  return exports;
}

const constantes = cargar("constants/fotosPublicacion");
const validacion = cargar("utils/validarFotoPublicacion", { "@/constants/fotosPublicacion": constantes });
const usuarios = cargar("services/usuariosService");
function servicio(solicitarFormulario) {
  return cargar("services/fotoPerfilService", {
    "@/services/httpClient": { solicitarFormulario },
    "@/services/usuariosService": usuarios,
    "@/utils/validarFotoPublicacion": validacion,
  });
}

test("el perfil acepta hasta 5.000.000 bytes y rechaza formatos incompatibles", () => {
  const { prepararFoto } = servicio();
  const foto = { uri: "file:///foto.png", fileSize: 5_000_000 };
  assert.equal(prepararFoto(foto).archivo.type, "image/png");
  assert.ok(prepararFoto({ ...foto, fileSize: 5_000_001 }).error);
  assert.ok(prepararFoto({ ...foto, mimeType: "image/heic" }).error);
  assert.ok(prepararFoto({ uri: "file:///desconocida" }).error);
});

test("envía el archivo por PUT con la identidad y exige la URL de la foto", async () => {
  const file = new File(["foto"], "perfil.webp", { type: "image/webp" });
  const url = "https://storage.example/perfil.webp";
  let datos = { foto_perfil: url };
  const { prepararFoto, guardarFotoPerfil } = servicio(async (ruta, opciones) => {
    assert.equal(ruta, "/api/usuarios/me/foto");
    assert.equal(opciones.metodo, "PUT");
    assert.equal(opciones.identidadEsperada, "cuenta-a");
    assert.equal(opciones.cuerpo.get("foto"), file);
    return { exito: true, datos };
  });
  const { archivo } = prepararFoto({ file, uri: "blob:foto" });
  assert.equal((await guardarFotoPerfil(archivo, "cuenta-a")).url, url);
  datos = { foto_perfil: "javascript:void(0)" };
  assert.equal((await guardarFotoPerfil(archivo, "cuenta-a")).exito, false);
});
