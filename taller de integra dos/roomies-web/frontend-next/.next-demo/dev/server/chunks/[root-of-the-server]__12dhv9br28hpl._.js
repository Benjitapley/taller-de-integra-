module.exports = [
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/src/app/web-api/publicaciones/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$publicaciones$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/publicaciones/server.ts [app-route] (ecmascript)");
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
async function POST(request) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$publicaciones$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleCreatePublication"])(request);
}
}),
"[project]/src/features/publicaciones/validation.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "publicationBodyLimit",
    ()=>publicationBodyLimit,
    "publicationImageLimit",
    ()=>publicationImageLimit,
    "validatePublicationForm",
    ()=>validatePublicationForm
]);
const publicationImageLimit = 5_000_000;
const publicationBodyLimit = 26_000_000;
const allowedFields = new Set([
    "titulo",
    "categoria",
    "ubicacion",
    "precio",
    "tipo",
    "cupos_totales",
    "id_region",
    "id_comuna",
    "tipo_vivienda",
    "descripcion",
    "mascota",
    "permitir_comentarios",
    "imagenes",
    "imagenes_conservar",
    "reglas"
]);
function validatePublicationForm(form) {
    for (const key of form.keys()){
        if (!allowedFields.has(key) || key !== "imagenes" && form.getAll(key).length !== 1) return "El formulario contiene campos no permitidos o repetidos.";
    }
    const text = (name)=>typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
    if (!text("titulo") || text("titulo").length > 200) return "El título es obligatorio y debe tener hasta 200 caracteres.";
    if (!text("ubicacion") || text("ubicacion").length > 250) return "La ubicación es obligatoria y debe tener hasta 250 caracteres.";
    if (!text("descripcion") || text("descripcion").length > 5000) return "La descripción es obligatoria y debe tener hasta 5000 caracteres.";
    if (text("tipo") !== "Arrendador") return "Selecciona una publicación de arrendador.";
    if (![
        "casa",
        "departamento",
        "habitacion"
    ].includes(text("tipo_vivienda"))) return "Selecciona un tipo de vivienda válido.";
    if (!/^\d{1,12}$/.test(text("precio"))) return "El precio debe ser un entero entre 0 y 999999999999 CLP.";
    for (const name of [
        "cupos_totales",
        "id_region",
        "id_comuna"
    ]){
        if (!/^[1-9]\d{0,9}$/.test(text(name)) || Number(text(name)) > 2147483647) return "Selecciona región, comuna y cupos válidos.";
    }
    if (![
        "si",
        "no"
    ].includes(text("mascota"))) return "Indica si se aceptan mascotas.";
    let retained = [];
    try {
        retained = JSON.parse(text("imagenes_conservar") || "[]");
    } catch  {
        return "Las imágenes conservadas no son válidas.";
    }
    if (!Array.isArray(retained) || !retained.every((id)=>Number.isSafeInteger(id) && id > 0) || new Set(retained).size !== retained.length) return "Las imágenes conservadas no son válidas.";
    const images = form.getAll("imagenes").filter((image)=>typeof image === "string" || image.name !== "" || image.size > 0);
    if (images.length + retained.length > 5) return "Puedes guardar hasta 5 imágenes en total.";
    for (const image of images){
        if (typeof image === "string") return "Selecciona una imagen válida.";
        if (image.size === 0) return "La imagen seleccionada está vacía.";
        if (image.size > publicationImageLimit) return "Cada imagen debe pesar como máximo 5 MB (5000000 bytes).";
        if (![
            "image/jpeg",
            "image/png",
            "image/webp"
        ].includes(image.type)) return "Usa imágenes JPG, PNG o WEBP.";
    }
    return null;
}
}),
"[project]/src/lib/auth/gateway.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authConfig",
    ()=>authConfig,
    "authError",
    ()=>authError,
    "authReply",
    ()=>authReply,
    "cookieName",
    ()=>cookieName,
    "getSession",
    ()=>getSession,
    "handleAuth",
    ()=>handleAuth,
    "profilePath",
    ()=>profilePath,
    "readToken",
    ()=>readToken,
    "sessionCookie",
    ()=>sessionCookie,
    "upstream",
    ()=>upstream
]);
;
function authConfig(env = process.env) {
    if (env.WEB_AUTH_ENABLED !== "true") return null;
    try {
        const web = new URL(env.WEB_AUTH_ORIGIN ?? "");
        const backend = new URL(env.WEB_AUTH_FASTAPI_ORIGIN ?? "");
        const provider = env.WEB_AUTH_PROVIDER ?? "legacy";
        if (![
            "legacy",
            "supabase"
        ].includes(provider)) return null;
        for (const url of [
            web,
            backend
        ]){
            if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
            const localGateway = url === backend && (env.ROOMIES_LOCAL_MODE === "1" || env.ROOMIES_RUNTIME_MODE === "supabase") && env.NODE_ENV !== "production" && url.hostname === "api-gateway";
            if (url.protocol !== "https:" && !(url.protocol === "http:" && ([
                "127.0.0.1",
                "localhost",
                "[::1]"
            ].includes(url.hostname) || localGateway))) return null;
        }
        if (web.origin === backend.origin || env.NODE_ENV === "production" && web.protocol !== "https:") return null;
        if (provider === "supabase") {
            const identity = new URL(env.WEB_SUPABASE_ORIGIN ?? "");
            const key = env.WEB_SUPABASE_PUBLISHABLE_KEY ?? "";
            const real = env.ROOMIES_RUNTIME_MODE === "supabase" && env.ROOMIES_LOCAL_MODE !== "1" && /^[a-z0-9]{20}$/.test(env.ROOMIES_SUPABASE_PROJECT_REF ?? "") && identity.origin === `https://${env.ROOMIES_SUPABASE_PROJECT_REF}.supabase.co`;
            const disposable = env.ROOMIES_LOCAL_MODE === "1" && (!env.ROOMIES_RUNTIME_MODE || env.ROOMIES_RUNTIME_MODE === "disposable") && [
                "127.0.0.1",
                "localhost",
                "[::1]",
                "host.docker.internal",
                "supabase-auth"
            ].includes(identity.hostname);
            if (!(real || disposable) || ![
                "http:",
                "https:"
            ].includes(identity.protocol) || identity.username || identity.password || identity.pathname !== "/" || identity.search || identity.hash || !key || key.length > 4096 || key.startsWith("sb_secret_") || /[\r\n]/.test(key)) return null;
            if (key.split(".").length === 3 && JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role !== "anon") return null;
            return {
                origin: web.origin,
                backend: backend.origin,
                secure: web.protocol === "https:",
                provider: "supabase",
                supabase: {
                    origin: identity.origin,
                    key
                },
                localSignupAutoconfirm: disposable && env.NODE_ENV !== "production",
                ...env.WEB_AUTH_RECOVERY_SECRET ? {
                    recoverySecret: env.WEB_AUTH_RECOVERY_SECRET
                } : {}
            };
        }
        return {
            origin: web.origin,
            backend: backend.origin,
            secure: web.protocol === "https:"
        };
    } catch  {
        return null;
    }
}
const cookieName = (config)=>config.provider === "supabase" ? config.secure ? "__Host-roomies_sb_access" : "roomies_sb_dev_access" : config.secure ? "__Host-haycupo_session" : "haycupo_dev_session";
const profilePath = (config)=>config.provider === "supabase" ? "/local/v1/perfil" : "/api/perfil";
function sessionCookie(config, token = "", maxAge = 0) {
    return `${cookieName(config)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? "; Secure" : ""}`;
}
function readToken(cookie, config) {
    const matches = (cookie ?? "").split(";").map((part)=>part.trim()).filter((part)=>part.startsWith(`${cookieName(config)}=`));
    if (matches.length !== 1) return "";
    const token = matches[0].slice(cookieName(config).length + 1);
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) && token.length <= 3800 ? token : "";
}
const messages = {
    400: "Revisa los datos o solicita un nuevo código si ha expirado.",
    401: "Credenciales incorrectas o sesión expirada. Inicia sesión nuevamente.",
    403: "Acceso no permitido. Si estás iniciando sesión, verifica primero tu correo.",
    404: "No se encontró la cuenta solicitada.",
    409: "La cuenta o el código requiere revisión. No se cambiaron tus credenciales.",
    422: "Revisa el formato y los límites de los campos indicados.",
    429: "Se alcanzó el límite de intentos o envíos. Espera antes de volver a intentar.",
    503: "No pudimos completar la solicitud. Intenta nuevamente en unos minutos. Si ya recibiste un correo de confirmación, utiliza su enlace o intenta iniciar sesión antes de repetir el registro."
};
function authReply(status, body, headers) {
    return Response.json(body, {
        status,
        headers: {
            "Cache-Control": "no-store",
            "Vary": "Cookie",
            ...headers
        }
    });
}
function authError(status, headers) {
    return authReply(status, {
        detail: messages[status] ?? messages[503]
    }, headers);
}
async function upstream(config, path, token, body, transport = fetch) {
    return transport(`${config.backend}${path}`, {
        method: body === undefined ? "GET" : "POST",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
            Accept: "application/json",
            ...body === undefined ? {} : {
                "Content-Type": "application/json"
            },
            ...token ? {
                Authorization: `Bearer ${token}`
            } : {}
        },
        ...body === undefined ? {} : {
            body: JSON.stringify(body)
        }
    });
}
async function getSession(config, token, transport = fetch) {
    if (!config) return authError(503);
    if (!token) return authError(401);
    try {
        const response = await upstream(config, profilePath(config), token, undefined, transport);
        if (!response.ok) return authError([
            401,
            403
        ].includes(response.status) ? response.status : 503);
        const profile = await response.json();
        if (!profile || typeof profile.nombre !== "string") return authError(503);
        // Explicit public shape: never echo arbitrary upstream fields or JWTs.
        let remaining;
        if (config.provider === "supabase") {
            try {
                remaining = Math.max(0, Math.floor(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp - Date.now() / 1000));
            } catch  {
                return authError(401);
            }
        }
        return authReply(200, {
            authenticated: true,
            user: {
                nombre: profile.nombre
            },
            ...remaining === undefined ? {} : {
                expires_in: remaining
            }
        });
    } catch  {
        return authError(503);
    }
}
const actions = [
    "registro",
    "verificar",
    "reenviar-codigo",
    "login",
    "logout",
    "sesion",
    "renovar",
    "confirmar",
    "recuperar",
    "recuperacion-callback",
    "cambiar-contrasena",
    "recuperacion-estado"
];
async function limitedJson(request) {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks = [];
    let size = 0;
    while(true){
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16_384) {
            await reader.cancel();
            throw new Error();
        }
        chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
}
async function handleAuth(request, action, config, transport = fetch) {
    if (!actions.includes(action)) return authReply(404, {
        detail: "Ruta no disponible."
    });
    if (!config) return authError(503);
    if (config.provider === "supabase") {
        const { handleSupabaseAuth } = await __turbopack_context__.A("[project]/src/lib/auth/supabase.ts [app-route] (ecmascript, async loader)");
        return handleSupabaseAuth(request, action, config, transport, {
            reply: authReply,
            error: authError,
            limitedJson,
            token: readToken,
            accessCookie: sessionCookie,
            session: getSession
        });
    }
    if ([
        "renovar",
        "confirmar",
        "recuperar",
        "recuperacion-callback",
        "cambiar-contrasena",
        "recuperacion-estado"
    ].includes(action)) return authReply(404, {
        detail: "Ruta no disponible."
    });
    const token = readToken(request.headers.get("cookie"), config);
    if (action === "sesion") {
        if (request.method !== "GET") return authReply(405, {}, {
            Allow: "GET"
        });
        const response = await getSession(config, token, transport);
        if ([
            401,
            403
        ].includes(response.status)) response.headers.set("Set-Cookie", sessionCookie(config));
        return response;
    }
    if (request.method !== "POST") return authReply(405, {}, {
        Allow: "POST"
    });
    // Fixed configured origin: do not trust Host or X-Forwarded-* from callers.
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" || request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin") return authError(403);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return authError(422);
    let data;
    try {
        data = await limitedJson(request);
    } catch  {
        return authError(422);
    }
    const fields = action === "registro" ? [
        "nombre",
        "correo",
        "contrasena",
        "fecha_nacimiento"
    ] : action === "login" ? [
        "correo",
        "contrasena"
    ] : action === "verificar" ? [
        "correo",
        "codigo"
    ] : action === "logout" ? [] : [
        "correo"
    ];
    if (fields.some((key)=>typeof data[key] !== "string" || !data[key].length) || Object.keys(data).some((key)=>!fields.includes(key))) return authError(422);
    if (action === "logout" && !token) return authError(401, {
        "Set-Cookie": sessionCookie(config)
    });
    try {
        const response = await upstream(config, `/auth/${action}`, action === "logout" ? token : "", data, transport);
        if (!response.ok) {
            const status = [
                400,
                401,
                403,
                404,
                409,
                422,
                429,
                503
            ].includes(response.status) ? response.status : 503;
            const headers = {};
            const retry = response.headers.get("retry-after");
            if (status === 429 && retry && /^\d{1,5}$/.test(retry)) headers["Retry-After"] = retry;
            if (action === "logout" && [
                401,
                403
            ].includes(status)) headers["Set-Cookie"] = sessionCookie(config);
            return authError(status, headers);
        }
        const result = await response.json();
        if (result?.success !== true) return authError(503);
        if (action === "login") {
            const jwt = result.access_token;
            if (typeof jwt !== "string" || jwt.length > 3800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt) || result.token_type !== "bearer") return authError(503);
            // This unverified exp only bounds cookie retention; authorization is always FastAPI's job.
            const exp = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).exp;
            const age = Math.floor(exp - Date.now() / 1000);
            if (!Number.isSafeInteger(exp) || age <= 0) return authError(503);
            if (!(await getSession(config, jwt, transport)).ok) return authError(503);
            return authReply(200, {
                success: true
            }, {
                "Set-Cookie": sessionCookie(config, jwt, Math.min(age, 86400))
            });
        }
        const message = action === "registro" ? "Revisa tu correo para verificar tu cuenta." : action === "verificar" ? "Cuenta verificada. Ya puedes iniciar sesión." : action === "logout" ? "Sesión revocada." : "Solicitud procesada. Revisa tu correo si la cuenta sigue pendiente.";
        return authReply(200, {
            success: true,
            message,
            ...action === "registro" ? {
                verificacion_pendiente: true
            } : {}
        }, action === "logout" ? {
            "Set-Cookie": sessionCookie(config)
        } : undefined);
    } catch  {
        return authError(503);
    }
}
}),
"[project]/src/lib/publicaciones/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleCreatePublication",
    ()=>handleCreatePublication,
    "handlePublicationRequest",
    ()=>handlePublicationRequest,
    "handleSavePublication",
    ()=>handleSavePublication
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/gateway.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$publicaciones$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/publicaciones/validation.ts [app-route] (ecmascript)");
;
;
;
const unavailable = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(503, {
        detail: "No se pudo confirmar la publicación. Comprueba tus publicaciones antes de volver a intentarlo."
    });
async function readForm(request) {
    const reader = request.body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let size = 0;
    while(true){
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$publicaciones$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["publicationBodyLimit"]) {
            await reader.cancel();
            throw new RangeError("form-too-large");
        }
        chunks.push(value);
    }
    try {
        return await new Response(Buffer.concat(chunks), {
            headers: {
                "Content-Type": request.headers.get("content-type")
            }
        }).formData();
    } catch  {
        return null;
    }
}
function upstreamDetail(value) {
    if (!value || typeof value !== "object" || !("detail" in value)) return null;
    const detail = value.detail;
    if (typeof detail === "string") return detail.slice(0, 500);
    if (!Array.isArray(detail)) return null;
    const messages = detail.flatMap((item)=>item && typeof item.msg === "string" ? [
            item.msg
        ] : []);
    return messages.length ? messages.join("; ").slice(0, 500) : null;
}
async function handleSavePublication(request, config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authConfig"])(), transport = fetch, publicationId) {
    const method = publicationId === undefined ? "POST" : "PUT";
    if (request.method !== method) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(405, {
        detail: "Método no permitido."
    }, {
        Allow: method
    });
    if (publicationId !== undefined && !/^[1-9]\d{0,9}$/.test(publicationId)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(400, {
        detail: "Identificador inválido."
    });
    if (!config) return unavailable();
    const expired = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(401, {
            detail: "Tu sesión ha expirado o ya no está disponible. Inicia sesión nuevamente."
        }, {
            "Set-Cookie": (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sessionCookie"])(config)
        });
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readToken"])(request.headers.get("cookie"), config);
    if (!token) return expired();
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" || request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin") {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(403, {
            code: "CSRF_REJECTED",
            detail: "Origen de solicitud no permitido."
        });
    }
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
            detail: "Envía el formulario de publicación completo."
        });
    }
    let form;
    try {
        form = await readForm(request);
    } catch (error) {
        if (error instanceof RangeError) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(413, {
            detail: "El formulario supera el tamaño permitido de 26 MB."
        });
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
            detail: "El formulario no es válido."
        });
    }
    if (!form) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
        detail: "El formulario no es válido."
    });
    const validationError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$publicaciones$2f$validation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validatePublicationForm"])(form);
    if (validationError) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
        detail: validationError
    });
    const images = form.getAll("imagenes").filter((image)=>typeof image !== "string" && (image.name !== "" || image.size > 0));
    form.delete("imagenes");
    for (const image of images)form.append("imagenes", image);
    try {
        const saved = await transport(`${config.backend}/api/publicaciones${publicationId === undefined ? "" : `/${publicationId}`}`, {
            method,
            body: form,
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(20_000),
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
                ...request.headers.has("Idempotency-Key") ? {
                    "Idempotency-Key": request.headers.get("Idempotency-Key")
                } : {}
            }
        });
        if (saved.status === 401) return expired();
        if (saved.status === 403) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(403, {
            detail: "No tienes permiso para crear publicaciones."
        });
        if (saved.status === 413) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(413, {
            detail: "La imagen debe pesar como máximo 5 MB."
        });
        if ([
            409,
            415,
            422
        ].includes(saved.status)) {
            let payload;
            try {
                payload = await saved.json();
            } catch  {
                payload = null;
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(saved.status, {
                detail: upstreamDetail(payload) ?? "Revisa los campos y selecciona imágenes válidas."
            });
        }
        if (!saved.ok) return unavailable();
        const result = await saved.json();
        if (!result || typeof result !== "object" || !("id_publicacion" in result) || !Number.isSafeInteger(result.id_publicacion) || result.id_publicacion < 1) return unavailable();
        if (method === "PUT") {
            if (result.id_publicacion !== Number(publicationId)) return unavailable();
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(200, {
                id_publicacion: result.id_publicacion,
                mensaje: "Publicación actualizada"
            });
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(201, {
            id_publicacion: result.id_publicacion,
            mensaje: "Publicación creada"
        });
    } catch  {
        return unavailable();
    }
}
const handleCreatePublication = handleSavePublication;
const fields = [
    "id_publicacion",
    "titulo",
    "precio",
    "estado",
    "tipo",
    "ubicacion",
    "cupos_totales",
    "cupos_disponibles",
    "imagenes",
    "categoria",
    "tipo_vivienda",
    "mascota",
    "descripcion",
    "permitir_comentarios",
    "id_region",
    "id_comuna",
    "reglas"
];
function publication(value) {
    if (!value || typeof value !== "object" || !("id_publicacion" in value) || !Number.isSafeInteger(value.id_publicacion) || Number(value.id_publicacion) < 1) throw new Error("Invalid response");
    const source = value;
    const result = Object.fromEntries(fields.filter((key)=>key in source).map((key)=>[
            key,
            source[key]
        ]));
    if (Array.isArray(source.imagenes)) result.imagenes = source.imagenes.map((image)=>({
            id_imagen: image.id_imagen,
            url: image.url,
            orden: image.orden
        }));
    return result;
}
async function handlePublicationRequest(request, operation, id, config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authConfig"])(), transport = fetch) {
    if (!config) return unavailable();
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readToken"])(request.headers.get("cookie"), config);
    const expired = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(401, {
            detail: "Inicia sesión nuevamente."
        }, {
            "Set-Cookie": (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sessionCookie"])(config)
        });
    if (!token) return expired();
    if (operation !== "mine" && (!id || !/^[1-9]\d{0,9}$/.test(id))) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(400, {
        detail: "Identificador inválido."
    });
    const method = operation === "close" ? "PATCH" : "GET";
    if (request.method !== method) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(405, {
        detail: "Método no permitido."
    }, {
        Allow: method
    });
    if (method !== "GET" && (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" || request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(403, {
        detail: "Origen de solicitud no permitido."
    });
    const query = new URLSearchParams();
    if (operation === "mine") {
        const supplied = new URL(request.url).searchParams;
        for (const key of [
            "limite",
            "cursor"
        ])if (supplied.has(key)) query.set(key, supplied.get(key));
    }
    const path = operation === "mine" ? `/api/publicaciones/mias${query.size ? `?${query}` : ""}` : `/api/publicaciones/${id}${operation === "close" ? "/cerrar" : ""}`;
    try {
        const response = await transport(`${config.backend}${path}`, {
            method,
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            }
        });
        if (response.status === 401) return expired();
        if ([
            403,
            404,
            409,
            422
        ].includes(response.status)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(response.status, {
            detail: "La publicación no está disponible para esta operación."
        });
        if (!response.ok) return unavailable();
        const body = await response.json();
        if (operation === "mine") {
            if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray(body.items) || !("siguiente_cursor" in body) || body.siguiente_cursor !== null && typeof body.siguiente_cursor !== "string") throw new Error("Invalid list");
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(200, {
                items: body.items.map(publication),
                siguiente_cursor: body.siguiente_cursor
            });
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(200, publication(body));
    } catch  {
        return unavailable();
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__12dhv9br28hpl._.js.map