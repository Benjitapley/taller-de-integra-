// Proxy SOLO PARA DESARROLLO: reenvía las peticiones al Gateway y agrega las cabeceras
// CORS que el Gateway todavía no envía. Sirve para probar la app en el navegador (Expo web).
// NO se sube al repositorio y no reemplaza el arreglo que debe hacer TI2 en el Gateway.
//
// Uso:   node proxy-cors.mjs
// Luego en .env.local:   EXPO_PUBLIC_API_URL=http://localhost:3001
import http from "node:http";

const DESTINO = (process.env.DESTINO ?? "https://roomies-main-api-gateway.onrender.com").replace(/\/+$/, "");
const PUERTO = Number(process.env.PUERTO ?? 3001);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept,Idempotency-Key",
  "Access-Control-Max-Age": "600",
};

function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    const partes = [];
    req.on("data", (parte) => partes.push(parte));
    req.on("end", () => resolver(Buffer.concat(partes)));
    req.on("error", rechazar);
  });
}

http
  .createServer(async (req, res) => {
    // La preconsulta del navegador se responde aquí, sin molestar al Gateway.
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    try {
      const cuerpo = req.method === "GET" || req.method === "HEAD" ? undefined : await leerCuerpo(req);
      const cabeceras = { ...req.headers };
      for (const nombre of ["host", "origin", "referer", "connection", "content-length", "accept-encoding"]) {
        delete cabeceras[nombre];
      }

      const respuesta = await fetch(DESTINO + req.url, { method: req.method, headers: cabeceras, body: cuerpo });

      const salida = {};
      respuesta.headers.forEach((valor, nombre) => {
        if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(nombre)) {
          salida[nombre] = valor;
        }
      });
      res.writeHead(respuesta.status, { ...salida, ...CORS });
      res.end(Buffer.from(await respuesta.arrayBuffer()));
      console.log(`${req.method} ${req.url} -> ${respuesta.status}`);
    } catch (error) {
      console.log(`${req.method} ${req.url} -> error: ${error.message}`);
      res.writeHead(502, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "El proxy de desarrollo no pudo llegar al Gateway." }));
    }
  })
  .listen(PUERTO, () => {
    console.log(`Proxy de desarrollo en http://localhost:${PUERTO} -> ${DESTINO}`);
  });
