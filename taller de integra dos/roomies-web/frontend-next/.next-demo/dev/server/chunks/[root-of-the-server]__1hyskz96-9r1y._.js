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
"[project]/src/app/web-api/conexiones/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>route,
    "GET",
    ()=>route,
    "POST",
    ()=>route,
    "PUT",
    ()=>route,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conexiones$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/conexiones/server.ts [app-route] (ecmascript)");
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
async function route(request) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$conexiones$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleConnections"])(request);
}
;
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
"[project]/src/lib/conexiones/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleConnections",
    ()=>handleConnections,
    "handlePeopleSearch",
    ()=>handlePeopleSearch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/gateway.ts [app-route] (ecmascript)");
;
;
const views = new Set([
    "recibidas",
    "enviadas",
    "aceptadas"
]);
const unavailable = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(503, {
        detail: "No se pudo confirmar la operación. Actualiza tus conexiones antes de volver a intentarlo."
    });
async function handlePeopleSearch(request, config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authConfig"])(), transport = fetch) {
    if (!config) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(503, {
        detail: "No se pudo cargar la búsqueda de personas."
    });
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readToken"])(request.headers.get("cookie"), config);
    const expired = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(401, {
            detail: "Inicia sesión nuevamente."
        }, {
            "Set-Cookie": (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sessionCookie"])(config)
        });
    if (!token) return expired();
    const query = new URL(request.url).searchParams;
    const allowed = [
        "presupuesto_max",
        "zona",
        "ocupacion"
    ];
    if ([
        ...query.keys()
    ].some((key)=>!allowed.includes(key) || query.getAll(key).length !== 1)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
            detail: "Revisa los filtros de búsqueda."
        });
    }
    try {
        const url = new URL("/conexiones/usuarios/otros", config.backend);
        url.search = query.toString();
        const response = await transport(url.toString(), {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            },
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(10_000)
        });
        if (response.status === 401) return expired();
        if (response.status === 403) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(403, {
            detail: "Tu cuenta no puede consultar personas."
        });
        if (response.status === 422) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
            detail: "Revisa los filtros de búsqueda."
        });
        if (!response.ok) throw new Error("búsqueda no disponible");
        const people = await response.json();
        if (!Array.isArray(people)) throw new Error("respuesta inválida");
        const fields = [
            "id_usuario_PK",
            "nombre",
            "edad",
            "presupuesto",
            "zona_interes",
            "ocupacion"
        ];
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(200, people.map((person)=>Object.fromEntries(fields.map((key)=>[
                    key,
                    person[key]
                ]))));
    } catch  {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(503, {
            detail: "No se pudo cargar la búsqueda de personas."
        });
    }
}
async function handleConnections(request, config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authConfig"])(), transport = fetch) {
    if (!config) return unavailable();
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readToken"])(request.headers.get("cookie"), config);
    const expired = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(401, {
            detail: "Inicia sesión nuevamente."
        }, {
            "Set-Cookie": (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sessionCookie"])(config)
        });
    if (!token) return expired();
    const method = request.method;
    if (![
        "GET",
        "POST",
        "PUT",
        "DELETE"
    ].includes(method)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(405, {
        detail: "Método no permitido."
    });
    let path;
    let body;
    if (method === "GET") {
        const query = new URL(request.url).searchParams;
        const view = query.get("vista") ?? "recibidas";
        if (!views.has(view) || [
            ...query.keys()
        ].some((k)=>k !== "vista") || query.getAll("vista").length > 1) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
            detail: "Vista inválida."
        });
        path = `/conexiones/${view}`;
    } else {
        if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" || request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin") return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(403, {
            detail: "Origen no permitido."
        });
        if (!request.headers.get("content-type")?.startsWith("application/json")) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
            detail: "Envía JSON válido."
        });
        try {
            const reader = request.body?.getReader();
            if (!reader) throw new Error();
            const chunks = [];
            let size = 0;
            while(true){
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.length;
                if (size > 1024) {
                    await reader.cancel();
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(413, {
                        detail: "Solicitud demasiado grande."
                    });
                }
                chunks.push(chunk.value);
            }
            const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
            const input = value;
            const allowed = method === "POST" ? [
                "id_receptor_FK"
            ] : method === "PUT" ? [
                "id",
                "estado"
            ] : [
                "id"
            ];
            if (Object.keys(input).some((k)=>!allowed.includes(k))) throw new Error();
            const id = method === "POST" ? input.id_receptor_FK : input.id;
            if (!Number.isSafeInteger(id) || Number(id) < 1) throw new Error();
            if (method === "PUT" && ![
                "Aceptada",
                "Rechazada"
            ].includes(String(input.estado))) throw new Error();
            path = method === "POST" ? "/conexiones/" : `/conexiones/${id}`;
            body = method === "POST" ? {
                id_receptor_FK: id
            } : method === "PUT" ? {
                estado: input.estado
            } : undefined;
        } catch  {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(422, {
                detail: "Revisa los datos de la conexión."
            });
        }
    }
    try {
        const response = await transport(`${config.backend}${path}`, {
            method,
            redirect: "error",
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
                ...body ? {
                    "Content-Type": "application/json"
                } : {}
            },
            ...body ? {
                body: JSON.stringify(body)
            } : {}
        });
        if (response.status === 401) return expired();
        if ([
            400,
            403,
            404,
            422
        ].includes(response.status)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(response.status, {
            detail: "La conexión no está disponible para esta operación."
        });
        if (!response.ok) return unavailable();
        if (method === "DELETE") return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(200, {
            success: true
        });
        const normalize = (value)=>{
            if (!value || typeof value !== "object") throw new Error();
            const item = value;
            if (![
                item.id_conexion,
                item.id_solicitante_FK,
                item.id_receptor_FK
            ].every((id)=>Number.isSafeInteger(id) && Number(id) > 0) || ![
                "Pendiente",
                "Aceptada",
                "Rechazada"
            ].includes(String(item.estado)) || typeof item.fecha_solicitud !== "string") throw new Error();
            return Object.fromEntries([
                "id_conexion",
                "id_solicitante_FK",
                "id_receptor_FK",
                "estado",
                "fecha_solicitud"
            ].map((k)=>[
                    k,
                    item[k]
                ]));
        };
        const value = await response.json();
        if (method === "GET" && !Array.isArray(value)) throw new Error();
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authReply"])(method === "POST" ? 201 : 200, Array.isArray(value) ? value.map(normalize) : normalize(value));
    } catch  {
        return unavailable();
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1hyskz96-9r1y._.js.map