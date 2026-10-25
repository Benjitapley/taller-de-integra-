import assert from "node:assert/strict";
import { createRequire } from "node:module";

/** Only used by proxy.test.mjs with its isolated HTTP double, never PostgreSQL. */
export async function profileBrowser({base,cookie,setProfileMode,playwrightPath,browserPath}) {
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
    assert.equal(await page.getByText("Ciudad A",{exact:true}).isVisible(),true);
    assert.equal(await page.getByText("25 años",{exact:true}).isVisible(),true);
    const photo=page.getByRole("img",{name:"Fotografía de Cuenta HTTP sintética"});
    await photo.waitFor();
    assert.equal(await photo.evaluate(async image=>{await image.decode();return image.naturalWidth>0;}),true);
    const nav=page.getByRole("navigation",{name:"Navegación principal"}).getByRole("link",{name:"Perfil",exact:true});
    assert.equal(await nav.getAttribute("aria-current"),"page");
    assert.equal(await nav.locator("small").count(),0,"no HTML legacy badge");
    assert.equal(await page.getByRole("button",{name:/Editar perfil/}).count(),0);
    await nav.focus();
    assert.equal(await nav.evaluate(link=>link===document.activeElement),true);
    await page.getByRole("button",{name:"Información de cuenta",exact:true}).click();
    assert.equal(await page.getByRole("link",{name:"Ver mi perfil",exact:true}).isVisible(),true);
    await page.keyboard.press("Escape");
    for(const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`horizontal overflow ${width}`);
    }
    assert.deepEqual(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}})),{local:{},session:{}});
    assert.doesNotMatch(await page.evaluate(()=>document.cookie),/haycupo_dev_session|fixture\./);
    await ctx.close();

    // Same route, independent cookie; no state/cache from A reaches B.
    const tokenB=`fixture-b.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")}.signature`;
    const b=await context(tokenB);
    await b.page.goto(base+"/perfil");
    await b.page.getByRole("heading",{name:"Cuenta B privada",exact:true}).waitFor();
    assert.equal(await b.page.getByText("Ciudad B",{exact:true}).isVisible(),true);
    assert.doesNotMatch(await b.page.locator("main").innerText(),/Cuenta HTTP sintética|Ciudad A/);
    await b.ctx.close();

    for(const mode of ["partial","empty","error","expired"]) {
      setProfileMode("ok"); // Parent layout checks the real session before the profile fetch.
      const view=await context();
      await view.page.route("**/web-api/perfil",route=>{setProfileMode(mode);return route.continue();});
      await view.page.goto(base+"/perfil");
      if(mode==="partial") {
        await view.page.getByRole("heading",{name:"Cuenta HTTP sintética",exact:true}).waitFor();
        assert.equal(await view.page.getByText("Sin indicar",{exact:true}).count(),3);
        assert.equal(await view.page.getByRole("img",{name:"Sin fotografía de perfil"}).isVisible(),true);
        assert.equal(await view.page.locator("main strong").innerText(),"0");
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
    await Promise.all(leaks);
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
  } finally {
    setProfileMode("ok");
    await browser.close();
  }
}
