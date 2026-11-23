module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/src/app/(auth)/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AccessPage,
    "dynamic",
    ()=>dynamic,
    "metadata",
    ()=>metadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthScreen$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthScreen.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/gateway.ts [app-rsc] (ecmascript)");
;
;
;
;
;
const dynamic = "force-dynamic";
const metadata = {
    title: "Acceso | ¿Hay cupo?"
};
async function AccessPage({ searchParams }) {
    const query = await searchParams;
    const config = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$gateway$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["authConfig"])();
    // Compatibilidad con Site URL existente: el código llega al BFF, nunca a JS.
    if (config?.provider === "supabase" && typeof query.code === "string" && /^[A-Za-z0-9_-]{10,512}$/.test(query.code)) {
        const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
        const recoveryName = config.secure ? "__Host-roomies_recovery_pkce" : "roomies_recovery_pkce_dev";
        const action = jar.has(recoveryName) ? "recuperacion-callback" : "confirmar";
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`/web-api/auth/${action}?code=${encodeURIComponent(query.code)}`);
    }
    const notice = query.correo === "verificado" ? "Correo verificado correctamente. Ya puedes iniciar sesión." + (query.perfil === "pendiente" ? " No se pudo preparar tu perfil; al iniciar sesión se intentará nuevamente." : "") : query.error ? "El enlace no es válido o ha expirado. Solicita uno nuevo." : "";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthScreen$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
        mode: "login",
        notice: notice,
        supabaseAuth: config?.provider === "supabase"
    }, void 0, false, {
        fileName: "[project]/src/app/(auth)/page.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/app/(auth)/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/(auth)/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/src/app/favicon.ico (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.v("/_next/static/media/favicon.117ezoe8m31dk.ico" + (globalThis["NEXT_CLIENT_ASSET_SUFFIX"] || ''));}),
"[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$favicon$2e$ico__$28$static__in__ecmascript$2c$__tag__client$29$__ = __turbopack_context__.i("[project]/src/app/favicon.ico (static in ecmascript, tag client)");
;
const __TURBOPACK__default__export__ = {
    src: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$favicon$2e$ico__$28$static__in__ecmascript$2c$__tag__client$29$__["default"],
    width: 48,
    height: 48
};
}),
"[project]/src/components/ui/Card.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Card
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ui$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/components/ui/ui.module.css [app-rsc] (css module)");
;
;
function Card({ className = "", soft = false, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ui$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].card} ${soft ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ui$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].soft : ""} ${className}`,
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Card.tsx",
        lineNumber: 5,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/components/ui/Icon.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Icon
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
;
const paths = {
    home: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "m3 10 9-7 9 7v10H3z"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 4,
                columnNumber: 11
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M9 20v-7h6v7"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 4,
                columnNumber: 43
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 4,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    search: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "10.5",
                cy: "10.5",
                r: "6.5"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 5,
                columnNumber: 13
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "m16 16 5 5"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 5,
                columnNumber: 51
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 5,
        columnNumber: 11
    }, ("TURBOPACK compile-time value", void 0)),
    chat: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M21 12a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.3-5.5A8.5 8.5 0 1 1 21 12Z"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 6,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    heart: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M12 21S3 15.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 7,
        columnNumber: 10
    }, ("TURBOPACK compile-time value", void 0)),
    user: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "12",
                cy: "8",
                r: "4"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 8,
                columnNumber: 11
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M4 21c0-5 3-8 8-8s8 3 8 8"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 8,
                columnNumber: 42
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 8,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    plus: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M12 4v16M4 12h16"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 9,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    file: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M6 3h9l4 4v14H6z"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 10,
                columnNumber: 11
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M15 3v5h4M9 12h7M9 16h7"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 10,
                columnNumber: 40
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 10,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    settings: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "12",
                cy: "12",
                r: "3"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 11,
                columnNumber: 15
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Icon.tsx",
                lineNumber: 11,
                columnNumber: 47
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 11,
        columnNumber: 13
    }, ("TURBOPACK compile-time value", void 0)),
    filter: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M4 7h16M7 12h10M10 17h4"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 12,
        columnNumber: 11
    }, ("TURBOPACK compile-time value", void 0)),
    menu: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M4 6h16M4 12h16M4 18h16"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 13,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    close: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "m6 6 12 12M6 18 18 6"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 14,
        columnNumber: 10
    }, ("TURBOPACK compile-time value", void 0))
};
function Icon({ name, size = 22, style }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.8",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        focusable: "false",
        style: {
            flexShrink: 0,
            ...style
        },
        children: paths[name]
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Icon.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/components/ui/ui.module.css [app-rsc] (css module)", ((__turbopack_context__) => {

__turbopack_context__.v({
  "button": "ui-module__Hi2WXW__button",
  "card": "ui-module__Hi2WXW__card",
  "close": "ui-module__Hi2WXW__close",
  "drawer": "ui-module__Hi2WXW__drawer",
  "empty": "ui-module__Hi2WXW__empty",
  "iconSquare": "ui-module__Hi2WXW__iconSquare",
  "modal": "ui-module__Hi2WXW__modal",
  "modalHeader": "ui-module__Hi2WXW__modalHeader",
  "modalSurface": "ui-module__Hi2WXW__modalSurface",
  "primary": "ui-module__Hi2WXW__primary",
  "scrim": "ui-module__Hi2WXW__scrim",
  "secondary": "ui-module__Hi2WXW__secondary",
  "soft": "ui-module__Hi2WXW__soft",
  "tabPanel": "ui-module__Hi2WXW__tabPanel",
  "tabs": "ui-module__Hi2WXW__tabs",
});
}),
"[project]/src/config/navigation.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authFlowLinks",
    ()=>authFlowLinks,
    "navigationItems",
    ()=>navigationItems,
    "routes",
    ()=>routes
]);
const routes = {
    access: "/",
    register: "/registro",
    verify: "/verificar",
    home: "/inicio",
    profile: "/perfil",
    publish: "/publicar"
};
const authFlowLinks = {
    login: [
        {
            href: routes.verify,
            label: "¿Tienes un código? Ir a verificación"
        }
    ],
    register: [
        {
            href: routes.verify,
            label: "¿Tienes un código? Ir a verificación"
        }
    ],
    verify: [
        {
            href: routes.access,
            label: "Volver al inicio de sesión"
        },
        {
            href: routes.register,
            label: "Volver al registro"
        }
    ]
};
const navigationItems = [
    {
        label: "Inicio",
        icon: "home",
        href: routes.home
    },
    {
        label: "Chat",
        icon: "chat"
    },
    {
        label: "Publicar",
        icon: "plus",
        href: routes.publish
    },
    {
        label: "Mis publicaciones",
        icon: "file",
        href: "/mis-publicaciones"
    },
    {
        label: "Mis conexiones",
        icon: "user",
        href: "/mis-conexiones"
    },
    {
        label: "Mis postulaciones",
        icon: "file",
        href: "/mis-postulaciones"
    },
    {
        label: "Favoritos",
        icon: "heart"
    },
    {
        label: "Perfil",
        icon: "user",
        href: routes.profile
    },
    {
        label: "Ajustes",
        icon: "settings"
    }
];
}),
"[project]/src/features/auth/AuthForm.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/features/auth/AuthForm.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/features/auth/AuthForm.tsx", "default");
}),
"[project]/src/features/auth/AuthForm.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthForm.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/features/auth/AuthScreen.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthScreen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$image$2d$component$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__Image__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/image-component.js [app-rsc] (ecmascript) <export Image as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Card.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/navigation.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthForm.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$VerificationForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/VerificationForm.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$EmailConfirmation$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/EmailConfirmation.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-rsc] (css module)");
;
;
;
;
;
;
;
;
;
;
function AuthScreen({ mode, supabaseAuth = false, notice = "", noticeType = "error", passwordMinimum = 6 }) {
    const register = mode === "register";
    const verify = mode === "verify";
    const demo = ("TURBOPACK compile-time value", "development") === "development" && process.env.ROOMIES_DEMO_MODE === "1";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].topbar,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].brand,
                        href: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routes"].access,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                name: "home",
                                size: 28
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 18,
                                columnNumber: 59
                            }, this),
                            "¿Hay cupo?"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                        lineNumber: 18,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].headerLink,
                        href: register || verify ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routes"].access : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routes"].register,
                        children: register || verify ? "Iniciar sesión" : "Crear cuenta"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                        lineNumber: 19,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                lineNumber: 17,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                id: "acceso-contenido",
                tabIndex: -1,
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].main,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].hero,
                        "aria-label": "Encuentra tu próximo hogar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].eyebrow,
                                children: "Un espacio para nuevos comienzos"
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 23,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                children: [
                                    "Tu próximo hogar ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 24,
                                        columnNumber: 30
                                    }, this),
                                    "empieza aquí."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 24,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Encuentra el lugar ideal para ti o comparte el tuyo."
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 25,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$image$2d$component$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__Image__as__default$3e$__["default"], {
                                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].sofa,
                                src: "/Iconos/sofa(login).webp",
                                alt: "Ilustración de un sofá",
                                width: 520,
                                height: 340,
                                preload: true
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 26,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].benefits,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                name: "user"
                                            }, void 0, false, {
                                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                                lineNumber: 28,
                                                columnNumber: 15
                                            }, this),
                                            "Conecta con personas que buscan o arriendan."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 28,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                name: "home"
                                            }, void 0, false, {
                                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                                lineNumber: 29,
                                                columnNumber: 15
                                            }, this),
                                            "Encuentra el arriendo o compañero ideal."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 29,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                name: "heart"
                                            }, void 0, false, {
                                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                                lineNumber: 30,
                                                columnNumber: 15
                                            }, this),
                                            "Comparte tu espacio, encuentra tu comunidad."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 30,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 27,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                        lineNumber: 22,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].card,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                children: verify ? "Verifica tu correo" : register ? "Crea tu cuenta" : "¡Bienvenido de vuelta!"
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 34,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].subtitle,
                                children: verify ? supabaseAuth ? "Abre el enlace de confirmación que recibiste por correo." : "Introduce tu correo y el código de seis dígitos." : register ? "Encuentra tu próximo espacio ideal." : "Inicia sesión para encontrar tu próximo hogar."
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 35,
                                columnNumber: 9
                            }, this),
                            demo && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "demo-notice",
                                role: "note",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: "Modo demo local."
                                    }, void 0, false, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 36,
                                        columnNumber: 57
                                    }, this),
                                    " Usa datos ficticios. Cuenta: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: "demo@haycupo.test"
                                    }, void 0, false, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 36,
                                        columnNumber: 120
                                    }, this),
                                    " · Clave: ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: "DemoLocal123!"
                                    }, void 0, false, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 36,
                                        columnNumber: 164
                                    }, this),
                                    ". El código de verificación es ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: "123456"
                                    }, void 0, false, {
                                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                        lineNumber: 36,
                                        columnNumber: 225
                                    }, this),
                                    "; no se envían correos."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 36,
                                columnNumber: 18
                            }, this),
                            register && !demo && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].hint,
                                children: "Usa un correo al que tengas acceso. Te enviaremos las instrucciones para confirmar tu cuenta."
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 37,
                                columnNumber: 31
                            }, this),
                            !verify && notice && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                role: "status",
                                children: notice
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 38,
                                columnNumber: 31
                            }, this),
                            verify ? supabaseAuth ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$EmailConfirmation$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                error: noticeType === "error" ? notice : "",
                                notice: noticeType === "info" ? notice : ""
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 39,
                                columnNumber: 34
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$VerificationForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 39,
                                columnNumber: 148
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                mode: mode,
                                passwordMinimum: passwordMinimum,
                                supabaseAuth: supabaseAuth,
                                demo: demo
                            }, mode, false, {
                                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                                lineNumber: 39,
                                columnNumber: 171
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/features/auth/AuthScreen.tsx",
                        lineNumber: 33,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/AuthScreen.tsx",
                lineNumber: 21,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/features/auth/AuthScreen.tsx",
        lineNumber: 16,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/features/auth/EmailConfirmation.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/features/auth/EmailConfirmation.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/features/auth/EmailConfirmation.tsx", "default");
}),
"[project]/src/features/auth/EmailConfirmation.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$EmailConfirmation$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/features/auth/EmailConfirmation.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$EmailConfirmation$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/features/auth/VerificationForm.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/features/auth/VerificationForm.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/features/auth/VerificationForm.tsx", "default");
}),
"[project]/src/features/auth/VerificationForm.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$VerificationForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/features/auth/VerificationForm.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$VerificationForm$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/lib/auth/gateway.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
        const { handleSupabaseAuth } = await __turbopack_context__.A("[project]/src/lib/auth/supabase.ts [app-rsc] (ecmascript, async loader)");
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
];

//# sourceMappingURL=%5Broot-of-the-server%5D__10452_yo3m5f5._.js.map