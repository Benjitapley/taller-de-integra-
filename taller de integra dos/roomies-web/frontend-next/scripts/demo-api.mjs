import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";

export const DEMO_CREDENTIALS = Object.freeze({ correo: "demo@haycupo.test", contrasena: "DemoLocal123!" });
const imageTypes = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const fail = (status, detail) => Object.assign(new Error(detail), { status });
const text = value => String(value ?? "").trim();
const fold = value => text(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => { request.off("data", data); request.off("end", end); request.off("error", error); };
    const error = cause => { cleanup(); reject(cause); };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const data = chunk => {
      size += chunk.length;
      if (size > limit) { error(fail(413, "El formulario supera el tamaño permitido.")); request.resume(); }
      else chunks.push(chunk);
    };
    request.on("data", data).on("end", end).on("error", error);
  });
}

async function json(request) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") throw fail(422, "Envía JSON válido.");
  try {
    const value = JSON.parse((await readBody(request, 16_384)).toString());
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value;
  } catch (error) { throw error.status ? error : fail(422, "Envía JSON válido."); }
}

async function form(request, limit = 26_000_000) {
  if (!request.headers["content-type"]?.startsWith("multipart/form-data;")) throw fail(422, "Envía el formulario completo.");
  const body = await readBody(request, limit);
  try { return await new Response(body, { headers: { "Content-Type": request.headers["content-type"] } }).formData(); }
  catch { throw fail(422, "Formulario inválido."); }
}

function send(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

/** Disposable loopback fixtures. They never connect to the project's real services. */
export async function startDemoApi() {
  if (process.env.NODE_ENV === "production") throw new Error("El modo demo solo puede iniciarse en desarrollo local.");
  const users = new Map([
    [1, { id: 1, ...DEMO_CREDENTIALS, nombre: "Estudiante Demo", edad: 23, ocupacion: "Estudiante", ciudad: "Temuco", breve_descripcion: "Busco un hogar tranquilo cerca de la universidad.", sobre_mi: "Perfil ficticio para recorrer Roomies y probar sus formularios.", foto_perfil: null, verificado: true, presupuesto: 250000, zona_interes: "Temuco" }],
    [2, { id: 2, correo: "camila@haycupo.test", nombre: "Camila Demo", edad: 25, ocupacion: "Trabajador", presupuesto: 320000, zona_interes: "Temuco Centro", verificado: true }],
    [3, { id: 3, correo: "matias@haycupo.test", nombre: "Matías Demo", edad: 22, ocupacion: "Estudiante", presupuesto: 220000, zona_interes: "Padre Las Casas", verificado: true }],
    [4, { id: 4, correo: "valentina@haycupo.test", nombre: "Valentina Demo", edad: 24, ocupacion: "Ambos", presupuesto: 280000, zona_interes: "Temuco", verificado: true }],
  ]);
  const publications = new Map([
    [1, { owner: 1, id_publicacion: 1, titulo: "Habitación demo cerca de la universidad", precio: 180000, ubicacion: "Sector universitario, Temuco", tipo_vivienda: "habitacion", descripcion: "Aviso ficticio: habitación luminosa para compartir con estudiantes.", mascota: "no" }],
    [2, { owner: 2, id_publicacion: 2, titulo: "Departamento demo en el centro de Temuco", precio: 250000, ubicacion: "Centro, Temuco", tipo_vivienda: "departamento", descripcion: "Aviso ficticio: departamento equipado, cercano a servicios y transporte.", mascota: "si" }],
    [3, { owner: 3, id_publicacion: 3, titulo: "Casa demo para compartir", precio: 220000, ubicacion: "Padre Las Casas", tipo_vivienda: "casa", descripcion: "Aviso ficticio: casa con espacios comunes para conocer otros roomies.", mascota: "si", id_comuna: 92 }],
  ].map(([id, value]) => [id, { tipo: "Arrendador", categoria: "ofrezco", estado: "Disponible", cupos_totales: 2, cupos_disponibles: 2, id_region: 9, id_comuna: 91, imagenes: [], reglas: [], permitir_comentarios: true, ...value }]));
  const connections = new Map([
    [1, { id_conexion: 1, id_solicitante_FK: 2, id_receptor_FK: 1, estado: "Pendiente", fecha_solicitud: new Date().toISOString() }],
    [2, { id_conexion: 2, id_solicitante_FK: 1, id_receptor_FK: 3, estado: "Aceptada", fecha_solicitud: new Date().toISOString() }],
  ]);
  const applications = new Map([
    [1, { id_postulacion: 1, id_publicacion: 1, id_usuario: 2, estado: "Pendiente", motivo: null, fecha_postulacion: new Date().toISOString() }],
    [2, { id_postulacion: 2, id_publicacion: 2, id_usuario: 1, estado: "Pendiente", motivo: null, fecha_postulacion: new Date().toISOString() }],
  ]);
  const sessions = new Map(), images = new Map();
  let nextUser = 5, nextPublication = 4, nextConnection = 3, nextApplication = 3, nextImage = 1;
  const publicPublication = ({ owner, ...value }) => value;
  const publicPerson = user => Object.fromEntries(["nombre", "edad", "presupuesto", "zona_interes", "ocupacion"].map(key => [key, user[key] ?? null]).concat([["id_usuario_PK", user.id]]));
  const publicApplication = row => ({ ...row, titulo: publications.get(row.id_publicacion)?.titulo ?? "Aviso demo", incorporacion_pendiente: row.estado === "Aceptada" });
  const userByEmail = correo => [...users.values()].find(user => user.correo === text(correo).toLowerCase());
  const requireUser = request => {
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    const session = sessions.get(token);
    if (!session || session.exp <= Date.now() / 1000) throw fail(401, "Inicia sesión con tu cuenta demo.");
    return { user: users.get(session.user), token };
  };
  const publicationById = id => {
    const row = publications.get(Number(id));
    if (!row) throw fail(404, "No existe este aviso demo.");
    return row;
  };
  const ownedPublication = (id, user) => {
    const row = publicationById(id);
    if (row.owner !== user.id) throw fail(403, "Solo puedes modificar tus avisos demo.");
    return row;
  };
  const storeImage = async (file, limit) => {
    if (!file || typeof file === "string" || !file.size || !imageTypes[file.type]) throw fail(422, "Usa una imagen JPG, PNG o WebP.");
    if (file.size > limit) throw fail(413, "La imagen supera el tamaño permitido.");
    const id = nextImage++;
    const path = `/imagenes/demo-${id}.${imageTypes[file.type]}`;
    images.set(path, { bytes: Buffer.from(await file.arrayBuffer()), type: file.type });
    return { id_imagen: id, url: path, orden: 0 };
  };
  const publicationForm = async (request, previous) => {
    const input = await form(request);
    const result = Object.fromEntries(["titulo", "ubicacion", "descripcion", "tipo_vivienda", "mascota"].map(key => [key, text(input.get(key))]));
    if (!result.titulo || result.titulo.length > 200 || !result.ubicacion || result.ubicacion.length > 250 || !result.descripcion || result.descripcion.length > 5000 ||
        !["casa", "departamento", "habitacion"].includes(result.tipo_vivienda) || !["si", "no"].includes(result.mascota) || input.get("tipo") !== "Arrendador") throw fail(422, "Revisa los campos del aviso demo.");
    for (const key of ["precio", "cupos_totales", "id_region", "id_comuna"]) {
      const raw = text(input.get(key));
      if (!/^\d{1,12}$/.test(raw) || !Number.isSafeInteger(Number(raw)) || (key !== "precio" && Number(raw) < 1)) throw fail(422, "Revisa precio, cupos y comuna.");
      result[key] = Number(raw);
    }
    if (result.id_region !== 9 || ![91, 92].includes(result.id_comuna)) throw fail(422, "Selecciona una comuna demo.");
    let retained, rules;
    try { retained = JSON.parse(text(input.get("imagenes_conservar")) || "[]"); rules = JSON.parse(text(input.get("reglas")) || "[]"); }
    catch { throw fail(422, "Revisa imágenes y reglas."); }
    if (!Array.isArray(retained) || new Set(retained).size !== retained.length || retained.some(id => !previous?.imagenes.some(image => image.id_imagen === id)) || !Array.isArray(rules) || rules.some(rule => typeof rule !== "string")) throw fail(422, "Revisa imágenes y reglas.");
    const files = input.getAll("imagenes").filter(file => typeof file === "string" || file.name || file.size);
    if (files.length + retained.length > 5) throw fail(422, "Puedes guardar hasta cinco imágenes.");
    const savedImages = [...(previous?.imagenes ?? []).filter(image => retained.includes(image.id_imagen))];
    for (const file of files) savedImages.push(await storeImage(file, 5_000_000));
    const occupied = previous ? previous.cupos_totales - previous.cupos_disponibles : 0;
    if (result.cupos_totales < occupied) throw fail(409, "Los cupos no pueden quedar por debajo de los ocupados.");
    return { ...result, tipo: "Arrendador", categoria: "ofrezco", permitir_comentarios: input.get("permitir_comentarios") === "true", reglas: rules, imagenes: savedImages.map((image, orden) => ({ ...image, orden })), cupos_disponibles: previous?.estado === "Cerrada" ? 0 : result.cupos_totales - occupied };
  };
  const page = (rows, query) => {
    const limit = Number(query.get("limite") ?? 20), cursor = query.get("cursor");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || (cursor && !/^demo-\d+$/.test(cursor))) throw fail(422, "Página demo inválida.");
    const start = cursor ? Number(cursor.slice(5)) : 0;
    return { items: rows.slice(start, start + limit).map(publicPublication), siguiente_cursor: start + limit < rows.length ? `demo-${start + limit}` : null };
  };

  const server = createServer(async (request, response) => {
    try {
      const { pathname: path, searchParams: query } = new URL(request.url, "http://127.0.0.1");
      const method = request.method;
      if (method === "GET" && path.startsWith("/imagenes/")) {
        const image = images.get(path);
        if (!image) throw fail(404, "Imagen demo no encontrada.");
        response.writeHead(200, { "Content-Type": image.type, "Content-Length": image.bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        response.end(image.bytes);
        return;
      }
      if (method === "POST" && ["/auth/login", "/auth/registro", "/auth/verificar", "/auth/reenviar-codigo"].includes(path)) {
        const input = await json(request);
        let user = userByEmail(input.correo);
        if (path === "/auth/registro") {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(input.correo)) || !text(input.nombre) || typeof input.contrasena !== "string" || input.contrasena.length < 6) throw fail(422, "Revisa los datos de tu cuenta demo.");
          if (user) throw fail(409, "Esta cuenta demo ya existe.");
          user = { id: nextUser++, nombre: text(input.nombre), correo: text(input.correo).toLowerCase(), contrasena: input.contrasena, verificado: false, edad: null, foto_perfil: null };
          users.set(user.id, user);
        } else if (path === "/auth/login") {
          if (!user || typeof input.contrasena !== "string" || !input.contrasena || input.contrasena !== user.contrasena) throw fail(401, "Credenciales demo incorrectas.");
          if (!user.verificado) throw fail(403, "Verifica la cuenta demo con el código 123456.");
          const exp = Math.floor(Date.now() / 1000) + 86400;
          const token = `demo.${Buffer.from(JSON.stringify({ sub: user.id, exp })).toString("base64url")}.${randomBytes(24).toString("base64url")}`;
          sessions.set(token, { user: user.id, exp });
          send(response, 200, { success: true, access_token: token, token_type: "bearer" });
          return;
        } else if (path === "/auth/verificar") {
          if (!user) throw fail(404, "Registra primero tu cuenta demo.");
          if (input.codigo !== "123456") throw fail(400, "El código demo es 123456.");
          user.verificado = true;
        }
        send(response, 200, { success: true });
        return;
      }
      if (method === "GET" && path === "/api/regiones") { send(response, 200, [{ id_region: 9, nombre: "La Araucanía" }]); return; }
      if (method === "GET" && path === "/api/regiones/9/comunas") {
        send(response, 200, [{ id_region: 9, id_comuna: 91, nombre: "Temuco" }, { id_region: 9, id_comuna: 92, nombre: "Padre Las Casas" }]); return;
      }
      if (method === "GET" && path === "/api/publicaciones") {
        let rows = [...publications.values()].filter(row => row.estado !== "Cerrada");
        for (const [key, compare] of [["precio_min", (a, b) => a >= b], ["precio_max", (a, b) => a <= b], ["cupos_disponibles", (a, b) => a === b]]) {
          if (query.has(key)) {
            if (!/^\d+$/.test(query.get(key))) throw fail(422, "Revisa los filtros del listado.");
            rows = rows.filter(row => compare(row[key.startsWith("precio") ? "precio" : key], Number(query.get(key))));
          }
        }
        if (query.get("consulta")) rows = rows.filter(row => fold(`${row.titulo} ${row.ubicacion} ${row.descripcion}`).includes(fold(query.get("consulta"))));
        for (const key of ["categoria", "tipo_vivienda", "mascota"]) if (query.get(key)) rows = rows.filter(row => row[key] === query.get(key));
        send(response, 200, page(rows, query)); return;
      }
      let match = /^\/api\/publicaciones\/(\d+)$/.exec(path);
      if (method === "GET" && match) { send(response, 200, publicPublication(publicationById(match[1]))); return; }
      match = /^\/conexiones\/usuarios\/(\d+)$/.exec(path);
      if (method === "GET" && match) {
        const person = users.get(Number(match[1]));
        if (!person) throw fail(404, "Perfil demo no encontrado.");
        send(response, 200, publicPerson(person)); return;
      }

      const { user, token } = requireUser(request);
      if (method === "POST" && path === "/auth/logout") { sessions.delete(token); send(response, 200, { success: true }); return; }
      if (path === "/api/perfil" && method === "GET") {
        const { correo, contrasena, id, ...profile } = user;
        send(response, 200, { ...profile, total_publicaciones: [...publications.values()].filter(row => row.owner === id).length }); return;
      }
      if (path === "/api/perfil" && method === "PUT") {
        const input = await form(request, 5 * 1024 * 1024 + 65_536);
        const age = text(input.get("edad"));
        if (age && (!/^\d{1,3}$/.test(age) || Number(age) > 120)) throw fail(422, "Revisa la edad.");
        const changes = { edad: age ? Number(age) : null };
        for (const [key, limit] of Object.entries({ ocupacion: 100, ciudad: 100, breve_descripcion: 255, sobre_mi: 5000 })) {
          const value = input.get(key);
          if (typeof value !== "string" || value.length > limit) throw fail(422, "Revisa los campos del perfil.");
          changes[key] = value.trim() || null;
        }
        const photo = input.get("foto");
        if (photo && (typeof photo === "string" || photo.size)) changes.foto_perfil = (await storeImage(photo, 5 * 1024 * 1024)).url;
        Object.assign(user, changes);
        send(response, 200, { success: true }); return;
      }
      if (method === "GET" && path === "/api/publicaciones/mias") { send(response, 200, page([...publications.values()].filter(row => row.owner === user.id), query)); return; }
      if (method === "POST" && path === "/api/publicaciones") {
        const row = { ...(await publicationForm(request)), owner: user.id, id_publicacion: nextPublication++, estado: "Disponible" };
        publications.set(row.id_publicacion, row); send(response, 201, publicPublication(row)); return;
      }
      match = /^\/api\/publicaciones\/(\d+)$/.exec(path);
      if (method === "PUT" && match) {
        const row = ownedPublication(match[1], user);
        Object.assign(row, await publicationForm(request, row)); send(response, 200, publicPublication(row)); return;
      }
      match = /^\/api\/publicaciones\/(\d+)\/cerrar$/.exec(path);
      if (method === "PATCH" && match) {
        const row = ownedPublication(match[1], user); row.estado = "Cerrada"; row.cupos_disponibles = 0;
        send(response, 200, publicPublication(row)); return;
      }
      if (method === "GET" && path === "/conexiones/usuarios/otros") {
        let rows = [...users.values()].filter(person => person.id !== user.id);
        if (query.get("zona")) rows = rows.filter(person => fold(person.zona_interes).includes(fold(query.get("zona"))));
        if (query.has("presupuesto_max")) {
          if (!/^\d+$/.test(query.get("presupuesto_max"))) throw fail(422, "Revisa el presupuesto.");
          rows = rows.filter(person => person.presupuesto <= Number(query.get("presupuesto_max")));
        }
        if (query.get("ocupacion")) rows = rows.filter(person => person.ocupacion === query.get("ocupacion"));
        send(response, 200, rows.map(publicPerson)); return;
      }
      match = /^\/conexiones\/(recibidas|enviadas|aceptadas)$/.exec(path);
      if (method === "GET" && match) {
        const rows = [...connections.values()].filter(row => match[1] === "recibidas" ? row.id_receptor_FK === user.id && row.estado === "Pendiente" : match[1] === "enviadas" ? row.id_solicitante_FK === user.id && row.estado === "Pendiente" : row.estado === "Aceptada" && [row.id_solicitante_FK, row.id_receptor_FK].includes(user.id));
        send(response, 200, rows); return;
      }
      if (method === "POST" && path === "/conexiones/") {
        const input = await json(request), id = input.id_receptor_FK;
        if (!Number.isSafeInteger(id) || id === user.id || !users.has(id)) throw fail(422, "Selecciona otra persona demo.");
        if ([...connections.values()].some(row => row.estado !== "Rechazada" && [row.id_solicitante_FK, row.id_receptor_FK].includes(id) && [row.id_solicitante_FK, row.id_receptor_FK].includes(user.id))) throw fail(409, "Ya existe una conexión demo.");
        const row = { id_conexion: nextConnection++, id_solicitante_FK: user.id, id_receptor_FK: id, estado: "Pendiente", fecha_solicitud: new Date().toISOString() };
        connections.set(row.id_conexion, row); send(response, 201, row); return;
      }
      match = /^\/conexiones\/(\d+)$/.exec(path);
      if (["PUT", "DELETE"].includes(method) && match) {
        const row = connections.get(Number(match[1]));
        if (!row) throw fail(404, "Conexión demo no encontrada.");
        if (![row.id_solicitante_FK, row.id_receptor_FK].includes(user.id)) throw fail(403, "Esta conexión pertenece a otra persona.");
        if (method === "DELETE") { connections.delete(row.id_conexion); response.writeHead(204); response.end(); return; }
        const input = await json(request);
        if (row.id_receptor_FK !== user.id) throw fail(403, "Solo el destinatario puede responder.");
        if (row.estado !== "Pendiente") throw fail(409, "La conexión ya tiene respuesta.");
        if (!["Aceptada", "Rechazada"].includes(input.estado)) throw fail(422, "Estado de conexión inválido.");
        row.estado = input.estado; send(response, 200, row); return;
      }
      if (method === "GET" && path === "/api/postulaciones/mias") { send(response, 200, [...applications.values()].filter(row => row.id_usuario === user.id).map(publicApplication)); return; }
      match = /^\/api\/publicaciones\/(\d+)\/postulantes$/.exec(path);
      if (method === "GET" && match) {
        const publication = ownedPublication(match[1], user);
        send(response, 200, [...applications.values()].filter(row => row.id_publicacion === publication.id_publicacion).map(publicApplication)); return;
      }
      match = /^\/api\/publicaciones\/(\d+)\/postulaciones$/.exec(path);
      if (method === "POST" && match) {
        const publication = publicationById(match[1]);
        if (publication.owner === user.id) throw fail(403, "Selecciona un aviso de otra persona.");
        if (publication.estado === "Cerrada" || publication.cupos_disponibles < 1 || [...applications.values()].some(row => row.id_publicacion === publication.id_publicacion && row.id_usuario === user.id && !["Cancelada", "Rechazada"].includes(row.estado))) throw fail(409, "El aviso no admite otra postulación demo.");
        const row = { id_postulacion: nextApplication++, id_publicacion: publication.id_publicacion, id_usuario: user.id, estado: "Pendiente", motivo: null, fecha_postulacion: new Date().toISOString() };
        applications.set(row.id_postulacion, row); send(response, 201, publicApplication(row)); return;
      }
      match = /^\/api\/postulaciones\/(\d+)\/estado$/.exec(path);
      if (method === "PATCH" && match) {
        const row = applications.get(Number(match[1]));
        if (!row) throw fail(404, "Postulación demo no encontrada.");
        const input = await json(request), publication = publicationById(row.id_publicacion);
        if (input.estado === "Cancelada" ? row.id_usuario !== user.id : publication.owner !== user.id) throw fail(403, "Esta decisión corresponde a otra cuenta.");
        const allowed = row.estado === "Pendiente" ? ["Preseleccionada", "Rechazada", "Cancelada"] : row.estado === "Preseleccionada" ? ["Aceptada", "Rechazada", "Cancelada"] : [];
        if (!allowed.includes(input.estado)) throw fail(409, "Ese cambio de estado no está disponible.");
        if (["Rechazada", "Cancelada"].includes(input.estado) && !text(input.motivo)) throw fail(422, "Indica el motivo.");
        if (input.motivo !== undefined && (typeof input.motivo !== "string" || input.motivo.length > 1000)) throw fail(422, "Revisa el motivo.");
        row.estado = input.estado; row.motivo = text(input.motivo) || null;
        send(response, 200, publicApplication(row)); return;
      }
      if (method === "GET" && path === "/api/admin/resumen") { send(response, 200, { usuarios: users.size, publicaciones: publications.size, conexiones: connections.size }); return; }
      if (method === "GET" && path === "/api/admin/publicaciones") {
        const pageNumber = Number(query.get("pagina") ?? 1);
        if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 100000) throw fail(422, "Página demo inválida.");
        const rows = [...publications.values()], start = (pageNumber - 1) * 20;
        send(response, 200, { pagina: pageNumber, hay_mas: start + 20 < rows.length, items: rows.slice(start, start + 20).map(row => ({ id: row.id_publicacion, titulo: row.titulo, ubicacion: row.ubicacion, estado: row.estado, precio: row.precio, cupos_totales: row.cupos_totales })) }); return;
      }
      throw fail(404, "Esta función no forma parte de la demo local.");
    } catch (error) { send(response, error.status ?? 500, { detail: error.status ? error.message : "No se pudo completar la operación demo." }); }
  });
  server.requestTimeout = 30_000;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }),
  };
}
