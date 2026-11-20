import assert from "node:assert/strict";
import { createRequire } from "node:module";

/** Only used by proxy.test.mjs with its isolated HTTP double, never PostgreSQL. */
export async function profileBrowser({base,cookie,setProfileMode,setVerificationMode,playwrightPath,browserPath}) {
  if(!playwrightPath || !browserPath) throw new Error("Explicit local Playwright and browser paths required");
  const { chromium }=createRequire(import.meta.url)(playwrightPath);
  const browser=await chromium.launch({executablePath:browserPath,headless:true,args:["--disable-background-networking","--disable-component-update","--disable-sync","--no-proxy-server"]});
  const errors=[],external=[],leaks=[];
  async function context(token=cookie.split("=")[1]) {
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:"block"});
    await ctx.addCookies([{name:"haycupo_dev_session",value:token,url:base,httpOnly:true,sameSite:"Strict"}]);
    await ctx.route("**/*",route=>{
      if(new URL(route.request().url()).origin!==base) { external.push("external request");return route.abort(); }
      return route.continue();
    });
    const page=await ctx.newPage();
    page.on("pageerror",error=>errors.push(error.message));
    page.on("response",response=>{
      if(new URL(response.url()).pathname==="/web-api/perfil") leaks.push(response.text().then(text=>{
        if(/should-not-leak|access_token|contrasena/.test(text)) errors.push("Private upstream fields leaked");
      }).catch(()=>{ /* Strict Mode/navigation can cancel an in-flight body. */ }));
    });
    return {ctx,page};
  }
  try {
    setProfileMode("ok");
    const {ctx,page}=await context();
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    await page.route("**/web-api/perfil",async route=>{await pending;await route.continue();});
    await page.goto(base+"/perfil");
    await page.getByText("Cargando tu perfil…",{exact:true}).waitFor();
    release();
    await page.getByRole("heading",{name:"Cuenta HTTP sintética",exact:true}).waitFor();
    await page.getByRole("heading",{name:"Verificación de cuenta",exact:true}).waitFor();
    assert.equal(await page.getByText("Correo verificado",{exact:true}).isVisible(),true);
    assert.equal(await page.getByRole("button",{name:"Reenviar código",exact:true}).count(),0);
    assert.equal(await page.getByText("Ciudad A",{exact:true}).isVisible(),true);
    assert.equal(await page.getByText("25 años",{exact:true}).isVisible(),true);
    const photo=page.getByRole("img",{name:"Fotografía de Cuenta HTTP sintética"});
    await photo.waitFor();
    assert.equal(await photo.evaluate(async image=>{await image.decode();return image.naturalWidth>0;}),true);
    const nav=page.getByRole("navigation",{name:"Navegación principal"}).getByRole("link",{name:"Perfil",exact:true});
    assert.equal(await nav.getAttribute("aria-current"),"page");
    assert.equal(await nav.locator("small").count(),0,"no HTML legacy badge");
    assert.equal(await page.getByRole("button",{name:/Editar perfil/}).count(),1);
    await nav.focus();
    assert.equal(await nav.evaluate(link=>link===document.activeElement),true);
    await page.getByRole("button",{name:"Información de cuenta",exact:true}).click();
    assert.equal(await page.getByRole("link",{name:"Ver mi perfil",exact:true}).isVisible(),true);
    await page.keyboard.press("Escape");
    for(const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`horizontal overflow ${width}`);
      await page.getByRole("button",{name:"Editar perfil",exact:true}).click();
      await page.getByRole("dialog",{name:"Editar perfil",exact:true}).waitFor();
      assert.equal(await page.getByLabel("Ciudad",{exact:true}).inputValue(),"Ciudad A");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`editor overflow ${width}`);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").isVisible(),false);
    }
    assert.deepEqual(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}})),{local:{},session:{}});
    assert.doesNotMatch(await page.evaluate(()=>document.cookie),/haycupo_dev_session|fixture\./);
    // Exercise the real gateway's CSRF rejections, then independent permission
    // and expired-session responses. A forbidden save must retain the editor.
    await page.getByRole("button",{name:"Editar perfil",exact:true}).click();
    await page.getByLabel("Ciudad",{exact:true}).fill("Cambios todavía sin guardar");
    await page.getByLabel("Sobre mí (biografía)",{exact:true}).fill("Biografía que se debe conservar");
    const selectedPhoto={name:"draft.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGNsYGhggAEmOAsvBwAzBAEI14KrBQAAAABJRU5ErkJggg==","base64")};
    await page.getByLabel("Fotografía",{exact:true}).setInputFiles(selectedPhoto);
    await page.getByRole("img",{name:"Vista previa de fotografía"}).evaluate(async image=>{await image.decode();});
    for(const mode of ["missing-csrf","foreign-origin","forbidden"]) {
      const intercept=async route=>{
        if(route.request().method()!=="PUT") return route.fallback();
        if(mode==="forbidden") return route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({code:"FORBIDDEN"})});
        const headers={...await route.request().allHeaders()};
        if(mode==="missing-csrf") delete headers["x-haycupo-csrf"];
        else headers.origin="https://blocked.invalid";
        // Preserve HttpOnly cookies, and inject headers at the local server
        // boundary without changing the browser's own same-origin request.
        return route.fulfill({response:await route.fetch({headers,maxRedirects:0})});
      };
      await page.route("**/web-api/perfil",intercept);
      const savedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==="/web-api/perfil" && response.request().method()==="PUT");
      await page.getByRole("button",{name:"Guardar cambios",exact:true}).click();
      const rejected=await savedResponse;
      assert.equal(rejected.status(),403,mode);
      assert.equal((await rejected.json()).code,mode==="forbidden"?"FORBIDDEN":"CSRF_REJECTED",mode);
      await page.getByRole("alert").filter({hasText:mode==="forbidden"?"No tienes permiso":"No se pudo validar el origen"}).waitFor();
      assert.equal(await page.getByRole("dialog",{name:"Editar perfil",exact:true}).isVisible(),true);
      assert.equal(await page.getByLabel("Ciudad",{exact:true}).inputValue(),"Cambios todavía sin guardar");
      assert.equal(await page.getByLabel("Sobre mí (biografía)",{exact:true}).inputValue(),"Biografía que se debe conservar");
      assert.equal(await page.getByLabel("Fotografía",{exact:true}).evaluate(input=>input.files[0].name),"draft.png");
      assert.equal(await page.getByRole("button",{name:"Guardar cambios",exact:true}).isEnabled(),true);
      assert.equal((await ctx.cookies()).find(c=>c.name==="haycupo_dev_session")?.value,cookie.split("=")[1]);
      assert.equal(await page.getByText("Tu sesión ha expirado o ya no está disponible.",{exact:true}).count(),0);
      await page.unroute("**/web-api/perfil",intercept);
    }
    await page.route("**/web-api/perfil",route=>route.request().method()==="PUT"
      ? route.fulfill({status:401,contentType:"application/json",body:JSON.stringify({detail:"Sesión inválida"})})
      : route.fallback());
    await page.getByRole("button",{name:"Guardar cambios",exact:true}).click();
    await page.getByRole("link",{name:"Volver a iniciar sesión",exact:true}).waitFor();
    assert.equal(await page.getByRole("dialog").count(),0);
    await ctx.close();

    // Same route, independent cookie; no state/cache from A reaches B.
    const tokenB=`fixture-b.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")}.signature`;
    const b=await context(tokenB);
    await b.page.goto(base+"/perfil");
    await b.page.getByRole("heading",{name:"Cuenta B privada",exact:true}).waitFor();
    assert.equal(await b.page.getByText("Ciudad B",{exact:true}).isVisible(),true);
    assert.doesNotMatch(await b.page.locator("main").innerText(),/Cuenta HTTP sintética|Ciudad A/);
    await b.ctx.close();

    for(const mode of ["partial","empty","error","pending","unknown","expired"]) {
      setProfileMode("ok"); // Parent layout checks the real session before the profile fetch.
      const view=await context();
      let firstProfile = true;
      await view.page.route("**/web-api/perfil",route=>{if(firstProfile) { setProfileMode(mode); firstProfile=false; } return route.continue();});
      await view.page.goto(base+"/perfil");
      if(mode==="partial") {
        await view.page.getByRole("heading",{name:"Cuenta HTTP sintética",exact:true}).waitFor();
        assert.equal(await view.page.getByText("Sin indicar",{exact:true}).count(),3);
        assert.equal(await view.page.getByRole("img",{name:"Sin fotografía de perfil"}).isVisible(),true);
        assert.equal(await view.page.locator("main strong").innerText(),"0");
      } else if(mode==="pending") {
        const p = view.page;
        const requests = [];
        p.on("request",request=>{if(request.url().includes("/web-api/auth/"))requests.push(request.url());});
        await p.getByRole("form",{name:"Verificación de correo",exact:true}).waitFor();
        await p.clock.install();
        await p.getByRole("button",{name:"Verificar correo",exact:true}).click();
        await p.getByRole("alert").filter({hasText:"Revisa los campos"}).waitFor();
        assert.equal(requests.length,0,"validation must not send a code/request");
        await p.getByLabel("Correo electrónico",{exact:true}).fill("pending@example.com");
        await p.getByLabel("Código de verificación",{exact:true}).fill("012345");
        setVerificationMode("invalid");
        await p.getByRole("button",{name:"Verificar correo",exact:true}).click();
        await p.getByRole("alert").filter({hasText:"Revisa los datos"}).waitFor();
        assert.equal(await p.getByText("Correo verificado",{exact:true}).count(),0);
        setVerificationMode("unavailable");
        await p.getByRole("button",{name:"Reenviar código",exact:true}).click();
        await p.getByRole("alert").filter({hasText:"Autenticación no disponible"}).waitFor();
        setVerificationMode("limited");
        await p.getByRole("button",{name:"Reenviar código",exact:true}).click();
        await p.getByRole("alert").filter({hasText:"límite de intentos"}).waitFor();
        const count = requests.length;
        await p.getByRole("button",{name:"Reenviar código",exact:true}).click();
        await p.getByRole("alert").filter({hasText:"Espera antes"}).waitFor();
        assert.equal(requests.length,count,"Retry-After must prevent another request");
        await p.clock.fastForward(61_000);
        setVerificationMode("ok");
        await p.getByRole("button",{name:"Reenviar código",exact:true}).click();
        await p.getByRole("status").filter({hasText:"Solicitud procesada"}).waitFor();
        assert.equal(await p.getByText("Correo verificado",{exact:true}).count(),0,"resend is not verification");
        setVerificationMode("unchanged");
        const previousForm = await p.getByRole("form",{name:"Verificación de correo",exact:true}).elementHandle();
        await p.getByRole("button",{name:"Verificar correo",exact:true}).click();
        await p.waitForFunction(element=>!element.isConnected,previousForm);
        await p.getByRole("form",{name:"Verificación de correo",exact:true}).waitFor();
        await p.getByLabel("Correo electrónico",{exact:true}).fill("pending@example.com");
        assert.equal(await p.getByText("Correo verificado",{exact:true}).count(),0,"only authenticated GET can confirm profile status");
        await p.getByLabel("Código de verificación",{exact:true}).fill("012345");
        setVerificationMode("ok");
        await p.getByRole("button",{name:"Verificar correo",exact:true}).click();
        await p.getByText("Correo verificado",{exact:true}).waitFor();
        assert.equal(new URL(p.url()).pathname,"/perfil","verification must not log out or navigate away");
        assert.equal((await view.ctx.cookies()).find(c=>c.name==="haycupo_dev_session")?.value,cookie.split("=")[1]);
        assert.equal(await p.getByRole("button",{name:"Reenviar código",exact:true}).count(),0);
      } else if(mode==="unknown") {
        await view.page.getByText("No se pudo determinar el estado de verificación del correo.",{exact:true}).waitFor();
        assert.equal(await view.page.getByText("Correo verificado",{exact:true}).count(),0);
        setProfileMode("ok");
        await view.page.getByRole("button",{name:"Consultar estado de verificación",exact:true}).click();
        await view.page.getByText("Correo verificado",{exact:true}).waitFor();
      } else if(mode==="empty") {
        await view.page.getByRole("heading",{name:"Perfil no disponible",exact:true}).waitFor();
        assert.equal(await view.page.getByRole("button",{name:"Volver a consultar",exact:true}).isVisible(),true);
      } else if(mode==="error") {
        const alert=view.page.locator("main").getByRole("alert");
        await alert.waitFor();
        assert.match(await alert.innerText(),/No se pudo cargar tu perfil/);
        await view.page.unroute("**/web-api/perfil");
        setProfileMode("ok");
        await view.page.getByRole("button",{name:"Reintentar",exact:true}).click();
        await view.page.getByRole("heading",{name:"Cuenta HTTP sintética",exact:true}).waitFor();
      } else {
        await view.page.getByRole("link",{name:"Volver a iniciar sesión",exact:true}).waitFor();
        assert.match(await view.page.locator("main").getByRole("alert").innerText(),/sesión ha expirado/);
        assert.equal((await view.ctx.cookies()).some(c=>c.name==="haycupo_dev_session"),false);
        assert.equal(await view.page.getByRole("heading",{name:"Cuenta HTTP sintética",exact:true}).count(),0);
        await view.page.goto(base+"/perfil");
        assert.equal(new URL(view.page.url()).pathname,"/");
      }
      await view.ctx.close();
    }
    // Verification can succeed after the web session has expired. Reload must
    // reject the stale cookie rather than display an optimistic verified badge.
    setProfileMode("ok");
    const stale = await context();
    let first = true;
    await stale.page.route("**/web-api/perfil",route=>{if(first) {setProfileMode("pending");first=false;}return route.continue();});
    await stale.page.goto(base+"/perfil");
    await stale.page.getByLabel("Correo electrónico",{exact:true}).fill("pending@example.com");
    await stale.page.getByLabel("Código de verificación",{exact:true}).fill("012345");
    setVerificationMode("expire-after-verify");
    await stale.page.getByRole("button",{name:"Verificar correo",exact:true}).click();
    await stale.page.getByRole("link",{name:"Volver a iniciar sesión",exact:true}).waitFor();
    assert.equal((await stale.ctx.cookies()).some(c=>c.name==="haycupo_dev_session"),false);
    assert.equal(await stale.page.getByText("Correo verificado",{exact:true}).count(),0);
    await stale.ctx.close();
    await Promise.all(leaks);
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
  } finally {
    setProfileMode("ok");
    await browser.close();
  }
}
