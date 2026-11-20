import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";

const RAIZ = new URL("../../", import.meta.url);


export function crearCargador({ externos = {}, entorno = {} } = {}) {
  const cache = new Map();

  function resolver(nombre) {
    const base = `src/${nombre.slice(2)}`;
    for (const extension of [".ts", ".tsx"]) {
      if (existsSync(new URL(base + extension, RAIZ))) return base + extension;
    }
    assert.fail(`Dependencia inesperada: ${nombre}`);
  }

  function cargar(ruta) {
    if (cache.has(ruta)) return cache.get(ruta);
    const fuente = readFileSync(new URL(ruta, RAIZ), "utf8");
    const compilado = ts.transpileModule(fuente, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const modulo = { exports: {} };
    cache.set(ruta, modulo.exports);
    runInNewContext(compilado, {
      exports: modulo.exports,
      URL,
      process: { env: entorno },
      console: {
        log: () => assert.fail("No registrar datos"),
        error: () => assert.fail("No registrar datos"),
        warn: () => assert.fail("No registrar datos"),
      },
      require(nombre) {
        if (nombre in externos) return externos[nombre];
        if (nombre === "react") return React;
        if (nombre === "react/jsx-runtime") return jsx;
        if (nombre.startsWith("@/")) return cargar(resolver(nombre));
        return assert.fail(`Dependencia inesperada: ${nombre}`);
      },
    });
    return modulo.exports;
  }

  return cargar;
}

export const plano = (valor) => JSON.parse(JSON.stringify(valor));
