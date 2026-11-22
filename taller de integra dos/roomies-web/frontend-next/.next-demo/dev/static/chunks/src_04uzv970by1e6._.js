(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/ui/Button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Button
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ui$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/components/ui/ui.module.css [app-client] (css module)");
;
;
function Button({ variant = "primary", className = "", type = "button", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: type,
        className: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ui$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].button} ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ui$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"][variant]} ${className}`,
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Button.tsx",
        lineNumber: 5,
        columnNumber: 10
    }, this);
}
_c = Button;
var _c;
__turbopack_context__.k.register(_c, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/ui.module.css [app-client] (css module)", ((__turbopack_context__) => {

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
"[project]/src/config/navigation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/AuthField.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthField
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function AuthField({ label, error, hint, type = "text", ...props }) {
    _s();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const [visible, setVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const password = type === "password";
    const description = [
        hint && `${id}-hint`,
        error && `${id}-error`
    ].filter(Boolean).join(" ") || undefined;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].field,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                htmlFor: id,
                children: label
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthField.tsx",
                lineNumber: 14,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].inputWrap,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        ...props,
                        id: id,
                        type: password && visible ? "text" : type,
                        "aria-invalid": error ? true : undefined,
                        "aria-describedby": description
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthField.tsx",
                        lineNumber: 16,
                        columnNumber: 7
                    }, this),
                    password && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].toggle,
                        type: "button",
                        "aria-controls": id,
                        "aria-pressed": visible,
                        "aria-label": visible ? "Ocultar contraseña" : "Mostrar contraseña",
                        onClick: ()=>setVisible(!visible),
                        children: visible ? "Ocultar" : "Mostrar"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthField.tsx",
                        lineNumber: 17,
                        columnNumber: 20
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/AuthField.tsx",
                lineNumber: 15,
                columnNumber: 5
            }, this),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: `${id}-hint`,
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].hint,
                children: hint
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthField.tsx",
                lineNumber: 19,
                columnNumber: 14
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: `${id}-error`,
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].fieldError,
                children: error
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthField.tsx",
                lineNumber: 20,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/features/auth/AuthField.tsx",
        lineNumber: 13,
        columnNumber: 10
    }, this);
}
_s(AuthField, "YPMfS6Zheb2t23pn/6BkSueCsd0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = AuthField;
var _c;
__turbopack_context__.k.register(_c, "AuthField");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/AuthFlowLinks.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthFlowLinks
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/navigation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
;
;
;
function AuthFlowLinks({ screen }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        "aria-label": "Pasos de acceso",
        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].flowLinks,
        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authFlowLinks"][screen].map(({ href, label })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: href,
                children: label
            }, href, false, {
                fileName: "[project]/src/features/auth/AuthFlowLinks.tsx",
                lineNumber: 7,
                columnNumber: 53
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/features/auth/AuthFlowLinks.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
_c = AuthFlowLinks;
var _c;
__turbopack_context__.k.register(_c, "AuthFlowLinks");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/AuthForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/navigation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthField.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$FormMessage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/FormMessage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/SubmitButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthFlowLinks$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthFlowLinks.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$useFormReady$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/useFormReady.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/validation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
var _s = __turbopack_context__.k.signature();
"use client";
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
;
;
function AuthForm({ mode, passwordMinimum = 6, supabaseAuth = false, demo = false }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const register = mode === "register";
    const ready = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$useFormReady$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormReady"])();
    const [values, setValues] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        nombre: "",
        correo: demo && !register ? "demo@haycupo.test" : "",
        contrasena: demo && !register ? "DemoLocal123!" : "",
        fecha_nacimiento: ""
    });
    const [errors, setErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [submitted, setSubmitted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    function update(name, value) {
        setValues((previous)=>({
                ...previous,
                [name]: value
            }));
        setErrors((previous)=>({
                ...previous,
                [name]: undefined
            }));
        setSubmitted(false);
    }
    async function submit(event) {
        event.preventDefault();
        if (pending) return;
        const nextErrors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateAuth"])(mode, values, new Date(), passwordMinimum);
        setErrors(nextErrors);
        setSubmitted(true);
        const first = Object.keys(nextErrors)[0];
        if (first) {
            event.currentTarget.querySelector(`input[name="${first}"]`)?.focus();
            return;
        }
        setPending(true);
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitAuth"])(register ? "registro" : "login", register ? {
            ...values,
            correo: values.correo.trim()
        } : {
            correo: values.correo.trim(),
            contrasena: values.contrasena
        });
        setPending(false);
        setFailed(!result.ok);
        setMessage(result.message);
        setValues((previous)=>({
                ...previous,
                contrasena: ""
            }));
        if (result.ok) {
            router.push(register ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routes"].verify + (supabaseAuth ? "?estado=registro-recibido" : "") : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routes"].home);
            router.refresh();
        }
    }
    const invalid = Object.values(errors).some(Boolean);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        noValidate: true,
        onSubmit: submit,
        "aria-label": register ? "Registro de usuarios" : "Inicio de sesión",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].fields,
                disabled: !ready || pending,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].srOnly,
                        children: register ? "Datos de registro" : "Credenciales de acceso"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 52,
                        columnNumber: 7
                    }, this),
                    register && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        label: "Nombre completo",
                        name: "nombre",
                        autoComplete: "name",
                        placeholder: "Tu nombre completo",
                        required: true,
                        value: values.nombre,
                        onChange: (e)=>update("nombre", e.target.value),
                        error: errors.nombre
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 53,
                        columnNumber: 20
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        label: "Correo electrónico",
                        name: "correo",
                        type: "email",
                        autoComplete: register ? "email" : "username",
                        inputMode: "email",
                        autoCapitalize: "none",
                        spellCheck: false,
                        placeholder: "ejemplo@correo.com",
                        required: true,
                        value: values.correo,
                        onChange: (e)=>update("correo", e.target.value),
                        error: errors.correo
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 54,
                        columnNumber: 7
                    }, this),
                    register && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        label: "Fecha de nacimiento",
                        name: "fecha_nacimiento",
                        type: "date",
                        autoComplete: "bday",
                        required: true,
                        hint: "Debes tener al menos 18 años.",
                        value: values.fecha_nacimiento,
                        onChange: (e)=>update("fecha_nacimiento", e.target.value),
                        error: errors.fecha_nacimiento
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 55,
                        columnNumber: 20
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        label: "Contraseña",
                        name: "contrasena",
                        type: "password",
                        autoComplete: register ? "new-password" : "current-password",
                        required: true,
                        minLength: register ? passwordMinimum : undefined,
                        hint: register ? `Mínimo ${passwordMinimum} caracteres.` : undefined,
                        value: values.contrasena,
                        onChange: (e)=>update("contrasena", e.target.value),
                        error: errors.contrasena
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 56,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        pending: pending,
                        children: [
                            register ? "Crear cuenta" : "Iniciar sesión",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                "aria-hidden": "true",
                                children: "→"
                            }, void 0, false, {
                                fileName: "[project]/src/features/auth/AuthForm.tsx",
                                lineNumber: 57,
                                columnNumber: 85
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 57,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 51,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("noscript", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "Activa JavaScript para validar el formulario. El envío seguro requiere JavaScript."
                }, void 0, false, {
                    fileName: "[project]/src/features/auth/AuthForm.tsx",
                    lineNumber: 59,
                    columnNumber: 15
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 59,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$FormMessage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                error: submitted && (invalid || failed),
                children: submitted ? invalid ? "Revisa los campos indicados." : message : null
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 60,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].switch,
                children: [
                    register ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?",
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: register ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routes"].access : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routes"].register,
                        children: register ? "Iniciar sesión" : "Crear cuenta nueva"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/AuthForm.tsx",
                        lineNumber: 61,
                        columnNumber: 91
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 61,
                columnNumber: 5
            }, this),
            !register && !demo && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: "/recuperar-contrasena",
                    children: "¿Olvidaste tu contraseña?"
                }, void 0, false, {
                    fileName: "[project]/src/features/auth/AuthForm.tsx",
                    lineNumber: 62,
                    columnNumber: 31
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 62,
                columnNumber: 28
            }, this),
            supabaseAuth ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                "aria-label": "Pasos de acceso",
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].flowLinks,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$navigation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routes"].verify,
                    children: "Verificar mi correo"
                }, void 0, false, {
                    fileName: "[project]/src/features/auth/AuthForm.tsx",
                    lineNumber: 64,
                    columnNumber: 72
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 64,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthFlowLinks$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                screen: mode
            }, void 0, false, {
                fileName: "[project]/src/features/auth/AuthForm.tsx",
                lineNumber: 65,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/features/auth/AuthForm.tsx",
        lineNumber: 49,
        columnNumber: 10
    }, this);
}
_s(AuthForm, "2Cr50JwiW3zMHmgcbGta4c9xUNw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$useFormReady$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormReady"]
    ];
});
_c = AuthForm;
var _c;
__turbopack_context__.k.register(_c, "AuthForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/EmailConfirmation.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EmailConfirmation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthField.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/SubmitButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function EmailConfirmation({ error = "", notice = "" }) {
    _s();
    const [email, setEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [retryAt, setRetryAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    async function resend(event) {
        event.preventDefault();
        if (pending) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setFailed(true);
            setMessage("Introduce un correo válido.");
            return;
        }
        if (Date.now() < retryAt) {
            setFailed(true);
            setMessage("Espera antes de volver a solicitar el enlace.");
            return;
        }
        setPending(true);
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitAuth"])("reenviar-codigo", {
            correo: email.trim()
        });
        setPending(false);
        setFailed(!result.ok);
        setMessage(result.message);
        if (result.retryAfter) setRetryAt(Date.now() + result.retryAfter * 1000);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        children: [
            notice && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].formMessage,
                children: notice
            }, void 0, false, {
                fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                lineNumber: 26,
                columnNumber: 16
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].errorMessage,
                children: error
            }, void 0, false, {
                fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                lineNumber: 27,
                columnNumber: 15
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Ábrelo en el mismo navegador donde creaste tu cuenta. Si el correo no aparece, revisa también la carpeta de spam."
            }, void 0, false, {
                fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                lineNumber: 28,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].headerLink,
                    href: "/",
                    children: "Ya confirmé mi correo, iniciar sesión"
                }, void 0, false, {
                    fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                    lineNumber: 29,
                    columnNumber: 8
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                lineNumber: 29,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                        children: "¿No recibiste el enlace o necesitas otro?"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                        lineNumber: 31,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: resend,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                            className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].fields,
                            disabled: pending,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                    className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].srOnly,
                                    children: "Reenviar confirmación"
                                }, void 0, false, {
                                    fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                                    lineNumber: 34,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    label: "Correo electrónico",
                                    name: "correo",
                                    type: "email",
                                    autoComplete: "email",
                                    required: true,
                                    value: email,
                                    onChange: (e)=>setEmail(e.target.value)
                                }, void 0, false, {
                                    fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                                    lineNumber: 35,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    pending: pending,
                                    children: "Reenviar enlace"
                                }, void 0, false, {
                                    fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                                    lineNumber: 36,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                            lineNumber: 33,
                            columnNumber: 9
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                        lineNumber: 32,
                        columnNumber: 7
                    }, this),
                    message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        role: failed ? "alert" : "status",
                        className: failed ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].errorMessage : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].formMessage,
                        children: message
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                        lineNumber: 39,
                        columnNumber: 19
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
                lineNumber: 30,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/features/auth/EmailConfirmation.tsx",
        lineNumber: 25,
        columnNumber: 10
    }, this);
}
_s(EmailConfirmation, "kbObecT4um4AcDHeKoXjJBdYPaE=");
_c = EmailConfirmation;
var _c;
__turbopack_context__.k.register(_c, "EmailConfirmation");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/FormMessage.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>FormMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
;
function FormMessage({ children, error = false }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: error ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].errorMessage : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].formMessage,
        role: error ? "alert" : "status",
        "aria-atomic": "true",
        children: children
    }, void 0, false, {
        fileName: "[project]/src/features/auth/FormMessage.tsx",
        lineNumber: 4,
        columnNumber: 10
    }, this);
}
_c = FormMessage;
var _c;
__turbopack_context__.k.register(_c, "FormMessage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/SubmitButton.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SubmitButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
;
;
function SubmitButton({ children, pending = false, name, value, variant = "primary", pendingLabel = "Procesando…" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].submit,
        type: "submit",
        name: name,
        value: value,
        variant: variant,
        disabled: pending,
        "aria-busy": pending,
        children: pending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].spinner,
                    "aria-hidden": "true"
                }, void 0, false, {
                    fileName: "[project]/src/features/auth/SubmitButton.tsx",
                    lineNumber: 10,
                    columnNumber: 18
                }, this),
                pendingLabel
            ]
        }, void 0, true, {
            fileName: "[project]/src/features/auth/SubmitButton.tsx",
            lineNumber: 10,
            columnNumber: 16
        }, this) : children
    }, void 0, false, {
        fileName: "[project]/src/features/auth/SubmitButton.tsx",
        lineNumber: 9,
        columnNumber: 10
    }, this);
}
_c = SubmitButton;
var _c;
__turbopack_context__.k.register(_c, "SubmitButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/VerificationForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>VerificationForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthField.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthFlowLinks$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/AuthFlowLinks.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$FormMessage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/FormMessage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/SubmitButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$useFormReady$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/useFormReady.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/features/auth/validation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__ = __turbopack_context__.i("[project]/src/features/auth/auth.module.css [app-client] (css module)");
;
var _s = __turbopack_context__.k.signature();
"use client";
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
function VerificationForm({ onVerified, showFlowLinks = true, supabase = false } = {}) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [failed, setFailed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [retryAt, setRetryAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const ready = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$useFormReady$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormReady"])();
    const [values, setValues] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        correo: "",
        codigo: ""
    });
    const [errors, setErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    function update(name, value) {
        setValues((previous)=>({
                ...previous,
                [name]: value
            }));
        setErrors((previous)=>({
                ...previous,
                [name]: undefined
            }));
        setMessage("");
    }
    async function submit(event) {
        event.preventDefault();
        if (pending) return;
        const submitter = event.nativeEvent.submitter;
        const action = submitter instanceof HTMLButtonElement && submitter.value === "resend" ? "resend" : "verify";
        const nextErrors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateVerification"])(values, action, supabase);
        setErrors(nextErrors);
        const first = Object.keys(nextErrors)[0];
        if (first) {
            setMessage("Revisa los campos indicados. No se enviaron solicitudes ni correos.");
            event.currentTarget.querySelector(`input[name="${first}"]`)?.focus();
        } else {
            if (Date.now() < retryAt) {
                setFailed(true);
                setMessage("Espera antes de volver a intentar.");
                return;
            }
            setPending(true);
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitAuth"])(action === "resend" ? "reenviar-codigo" : "verificar", action === "resend" ? {
                correo: values.correo.trim()
            } : {
                ...values,
                correo: values.correo.trim()
            });
            setPending(false);
            setFailed(!result.ok);
            setMessage(result.message);
            if (result.retryAfter) setRetryAt(Date.now() + result.retryAfter * 1000);
            if (result.ok && action === "verify") {
                if (onVerified) onVerified();
                else {
                    router.push("/");
                    router.refresh();
                }
            }
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        noValidate: true,
        onSubmit: submit,
        "aria-label": "Verificación de correo",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].fields,
                disabled: !ready || pending,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].srOnly,
                        children: "Correo y código de verificación"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/VerificationForm.tsx",
                        lineNumber: 57,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        label: "Correo electrónico",
                        name: "correo",
                        type: "email",
                        autoComplete: "email",
                        inputMode: "email",
                        autoCapitalize: "none",
                        spellCheck: false,
                        required: true,
                        placeholder: "ejemplo@correo.com",
                        value: values.correo,
                        error: errors.correo,
                        onChange: (e)=>update("correo", e.target.value)
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/VerificationForm.tsx",
                        lineNumber: 58,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthField$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        label: "Código de verificación",
                        name: "codigo",
                        type: "text",
                        inputMode: "numeric",
                        autoComplete: "one-time-code",
                        pattern: supabase ? "[0-9]{6,10}" : "[0-9]{6}",
                        spellCheck: false,
                        required: true,
                        placeholder: "000000",
                        hint: supabase ? "Introduce el código recibido por correo o utiliza su enlace de confirmación." : "Introduce los 6 dígitos del código. Los ceros iniciales se conservan.",
                        value: values.codigo,
                        error: errors.codigo,
                        onChange: (e)=>update("codigo", e.target.value)
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/VerificationForm.tsx",
                        lineNumber: 59,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        pending: pending,
                        name: "action",
                        value: "verify",
                        pendingLabel: "Verificando…",
                        children: "Verificar correo"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/VerificationForm.tsx",
                        lineNumber: 60,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$auth$2e$module$2e$css__$5b$app$2d$client$5d$__$28$css__module$29$__["default"].hint,
                        children: "¿Necesitas otro código? El reenvío requiere el correo y está sujeto a límites de envío."
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/VerificationForm.tsx",
                        lineNumber: 61,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$SubmitButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        pending: pending,
                        name: "action",
                        value: "resend",
                        variant: "secondary",
                        pendingLabel: "Solicitando código…",
                        children: "Reenviar código"
                    }, void 0, false, {
                        fileName: "[project]/src/features/auth/VerificationForm.tsx",
                        lineNumber: 62,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/features/auth/VerificationForm.tsx",
                lineNumber: 56,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("noscript", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "Activa JavaScript para validar el formulario. No se enviará el formulario sin JavaScript."
                }, void 0, false, {
                    fileName: "[project]/src/features/auth/VerificationForm.tsx",
                    lineNumber: 64,
                    columnNumber: 15
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/features/auth/VerificationForm.tsx",
                lineNumber: 64,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$FormMessage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                error: failed || Object.values(errors).some(Boolean),
                children: message
            }, void 0, false, {
                fileName: "[project]/src/features/auth/VerificationForm.tsx",
                lineNumber: 65,
                columnNumber: 5
            }, this),
            showFlowLinks && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$AuthFlowLinks$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                screen: "verify"
            }, void 0, false, {
                fileName: "[project]/src/features/auth/VerificationForm.tsx",
                lineNumber: 66,
                columnNumber: 23
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/features/auth/VerificationForm.tsx",
        lineNumber: 55,
        columnNumber: 10
    }, this);
}
_s(VerificationForm, "dbd7DMwX/nuP6hXStuPzqYYhS3I=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$features$2f$auth$2f$useFormReady$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFormReady"]
    ];
});
_c = VerificationForm;
var _c;
__turbopack_context__.k.register(_c, "VerificationForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/auth.module.css [app-client] (css module)", ((__turbopack_context__) => {

__turbopack_context__.v({
  "benefits": "auth-module__SUv9sW__benefits",
  "brand": "auth-module__SUv9sW__brand",
  "card": "auth-module__SUv9sW__card",
  "errorMessage": "auth-module__SUv9sW__errorMessage",
  "eyebrow": "auth-module__SUv9sW__eyebrow",
  "field": "auth-module__SUv9sW__field",
  "fieldError": "auth-module__SUv9sW__fieldError",
  "fields": "auth-module__SUv9sW__fields",
  "flowLinks": "auth-module__SUv9sW__flowLinks",
  "formMessage": "auth-module__SUv9sW__formMessage",
  "headerLink": "auth-module__SUv9sW__headerLink",
  "hero": "auth-module__SUv9sW__hero",
  "hint": "auth-module__SUv9sW__hint",
  "inputWrap": "auth-module__SUv9sW__inputWrap",
  "layout": "auth-module__SUv9sW__layout",
  "main": "auth-module__SUv9sW__main",
  "notice": "auth-module__SUv9sW__notice",
  "skipLink": "auth-module__SUv9sW__skipLink",
  "sofa": "auth-module__SUv9sW__sofa",
  "spin": "auth-module__SUv9sW__spin",
  "spinner": "auth-module__SUv9sW__spinner",
  "srOnly": "auth-module__SUv9sW__srOnly",
  "submit": "auth-module__SUv9sW__submit",
  "subtitle": "auth-module__SUv9sW__subtitle",
  "switch": "auth-module__SUv9sW__switch",
  "toggle": "auth-module__SUv9sW__toggle",
  "topbar": "auth-module__SUv9sW__topbar",
});
}),
"[project]/src/features/auth/client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "submitAuth",
    ()=>submitAuth
]);
async function submitAuth(action, body) {
    try {
        const response = await fetch(`/web-api/auth/${action}`, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                "X-Haycupo-CSRF": "1"
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(action === "cambiar-contrasena" ? 45_000 : 15_000)
        });
        const data = await response.json();
        const retry = response.headers.get("retry-after");
        return {
            ok: response.ok && data.success === true,
            status: response.status,
            message: String(data.detail ?? data.message ?? (response.ok && data.success === true ? "Sesión iniciada." : "No se confirmó la operación.")),
            retryAfter: response.status === 429 && retry && /^\d{1,5}$/.test(retry) ? Number(retry) : 0
        };
    } catch  {
        return {
            ok: false,
            status: 503,
            message: "No se pudo contactar al servicio. No se confirmó la operación; comprueba tu cuenta antes de repetirla.",
            retryAfter: 0
        };
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/useFormReady.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useFormReady",
    ()=>useFormReady
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
const subscribe = ()=>()=>{};
const clientReady = ()=>true;
const serverReady = ()=>false;
function useFormReady() {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribe, clientReady, serverReady);
}
_s(useFormReady, "FpwL93IKMLJZuQQXefVtWynbBPQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/features/auth/validation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validateAuth",
    ()=>validateAuth,
    "validateEmail",
    ()=>validateEmail,
    "validateVerification",
    ()=>validateVerification
]);
function validateEmail(value) {
    const email = value.trim();
    if (!email) return "Ingresa tu correo electrónico.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresa un correo electrónico válido.";
}
function validateVerification(values, action = "verify", supabase = false) {
    const errors = {};
    const emailError = validateEmail(values.correo);
    if (emailError) errors.correo = emailError;
    if (action === "verify") {
        if (!values.codigo) errors.codigo = "Ingresa el código de verificación.";
        else if (!(supabase ? /^[0-9]{6,10}$/ : /^[0-9]{6}$/).test(values.codigo)) errors.codigo = supabase ? "Ingresa el código numérico recibido, sin espacios ni letras." : "Ingresa exactamente 6 dígitos, sin espacios ni letras.";
    }
    return errors;
}
function validateAuth(mode, values, today = new Date(), minimumPasswordLength = 6) {
    const errors = {};
    if (mode === "register" && !values.nombre.trim()) errors.nombre = "Ingresa tu nombre completo.";
    const emailError = validateEmail(values.correo);
    if (emailError) errors.correo = emailError;
    // La contraseña se conserva exactamente como se escribe, incluidos espacios.
    if (!values.contrasena) errors.contrasena = "Ingresa tu contraseña.";
    else if (mode === "register" && values.contrasena.length < minimumPasswordLength) errors.contrasena = `Usa al menos ${minimumPasswordLength} caracteres en la contraseña.`;
    if (mode === "register") {
        const raw = values.fecha_nacimiento;
        if (!raw) errors.fecha_nacimiento = "Ingresa tu fecha de nacimiento.";
        else {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
            const [year, month, day] = match ? match.slice(1).map(Number) : [
                0,
                0,
                0
            ];
            const birth = new Date(0);
            birth.setFullYear(year, month - 1, day);
            birth.setHours(0, 0, 0, 0);
            if (!match || year < 1 || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
                errors.fecha_nacimiento = "Ingresa una fecha de nacimiento válida.";
            } else {
                const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const birthdayPending = today.getMonth() < month - 1 || today.getMonth() === month - 1 && today.getDate() < day;
                const age = today.getFullYear() - year - Number(birthdayPending);
                if (birth > current) errors.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
                else if (age < 18) errors.fecha_nacimiento = "Debes tener al menos 18 años para registrarte.";
            }
        }
    }
    return errors;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_04uzv970by1e6._.js.map