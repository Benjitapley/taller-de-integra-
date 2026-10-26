/** Real manual-mode lifecycle + browser, no personal environment or profile. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';

const root = fileURLToPath(new URL('../../', import.meta.url));
const python = join(root, '.venv/Scripts/python.exe');
const pg = process.env.MANUAL_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const playwrightPath = process.env.MANUAL_PLAYWRIGHT_PATH ?? 'C:/Users/gerla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const browserPath = process.env.MANUAL_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ['SYSTEMROOT','WINDIR','TEMP','TMP','COMSPEC','PATHEXT'].includes(key.toUpperCase())));
// Deliberately poisoned inherited configuration must never reach the services.
Object.assign(env, { DATABASE_URL: 'postgresql://synthetic:decoy@blocked.invalid/not-used', SMTP_HOST: 'blocked.invalid', WEB_AUTH_FASTAPI_ORIGIN: 'https://blocked.invalid', AUTH_JWT_ENABLED: 'false' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 60_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = fn(); if (value) return value; await sleep(40); }
  throw new Error('Timed out waiting for isolated manual session');
}
async function snapshot() {
  return { fixture: (await readdir(tmpdir())).filter(n => n.startsWith('haycupo-manual-')).sort(), app: (await readdir(join(root,'frontend-next'))).filter(n => n.startsWith('.proxy-test-manual-')).sort() };
}
async function closed(port) {
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.on('connect', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(true));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}
async function session(interrupt = false) {
  const before = await snapshot();
  // Deliver Python's normal SIGINT/KeyboardInterrupt in the real runner after
  // readiness. This exercises Ctrl+C cleanup without signalling the user's shell.
  const interruptCode = `import sys,threading,_thread,runpy
class Output:
 def __getattr__(self,key): return getattr(sys.__stdout__,key)
 def write(self,value):
  result=sys.__stdout__.write(value)
  if value.startswith('MANUAL_URL='):
   timer=threading.Timer(1,_thread.interrupt_main);timer.daemon=True;timer.start()
  return result
sys.stdout=Output()
sys.argv=sys.argv[1:]
runpy.run_path(sys.argv[0],run_name='__main__')`;
  const invocation = interrupt ? ['-I','-B','-c',interruptCode] : ['-I','-B'];
  const child = spawn(python, [...invocation,join(root,'tests/e2e/run_e2e.py'),'--manual','--no-open','--pg-bin',pg,'--node',process.execPath], { cwd: root, env, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  const exited = once(child,'exit');
  let output = '';
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { output += value; });
  try {
    await until(() => {
      if (child.exitCode !== null) throw new Error(`Manual startup failed: ${output.slice(-3000)}`);
      return /MANUAL_URL=(http:\/\/127\.0\.0\.1:\d+)\/registro/.exec(output);
    });
  } catch (error) { child.stdin.end(); await exited; throw error; }
  const base = /MANUAL_URL=(http:\/\/127\.0\.0\.1:\d+)\/registro/.exec(output)[1];
  const ports = JSON.parse(/MANUAL_PORTS=(.+)/.exec(output)[1]);
  return { base, child, output: () => output, async stop(command = 'salir\n') {
    if (command !== 'interrupt') {
      if (command === null) child.stdin.end(); else child.stdin.end(command);
    }
    const [code] = await exited;
    child.stdin.destroy();
    assert.equal(code, 0, output.slice(-3000));
    if (command === 'interrupt') assert.match(output, /Sesión interrumpida/);
    assert.match(output, /PASS cleanup:/);
    for (const [service, port] of Object.entries(ports)) assert.equal(await closed(port), true, `${service} still listening`);
    assert.deepEqual(await snapshot(), before, 'Temporary cluster/application directories remain');
  }};
}

test('manual: real registration, captured mail, verification, HttpOnly login, profile/photo persistence and salir cleanup', { timeout: 150_000 }, async () => {
  const running = await session();
  const { chromium } = createRequire(import.meta.url)(playwrightPath);
  let browser;
  try {
    assert.match(running.output(), /PASS Next isolation guards/);
    assert.match(running.output(), /PASS backend isolation guards/);
    browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--disable-background-networking','--disable-component-update','--disable-sync','--no-proxy-server'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const external = [], errors = [];
    await ctx.route('**/*', route => {
      if (new URL(route.request().url()).origin !== running.base) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', e => errors.push(e.message));
    const password = randomBytes(18).toString('base64url');
    const correo = 'manual-browser@example.com';
    await page.goto(running.base + '/registro');
    const rejected = await page.evaluate(async password => {
      const response = await fetch('/web-api/auth/registro', { method: 'POST', headers: {'Content-Type':'application/json','X-Haycupo-CSRF':'1'}, body: JSON.stringify({nombre:'Prueba sintética',correo:'synthetic@blocked.invalid',contrasena:password,fecha_nacimiento:'2000-01-01'}) });
      return response.status;
    }, password);
    assert.equal(rejected, 422, 'External recipients must be rejected');
    await page.getByLabel('Nombre completo',{exact:true}).fill('Roomie manual sintético');
    await page.getByLabel('Correo electrónico',{exact:true}).fill(correo);
    await page.getByLabel('Fecha de nacimiento',{exact:true}).fill('2000-01-01');
    await page.getByLabel('Contraseña',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
    await page.waitForURL(running.base + '/verificar');
    const match = await until(() => /CORREO LOCAL "manual-browser@example.com" \| código: (\d{6})/.exec(running.output()));
    running.child.stdin.write('correos\n');
    await until(() => running.output().includes('último código:'));
    await page.getByLabel('Correo electrónico',{exact:true}).fill(correo);
    await page.getByLabel('Código de verificación',{exact:true}).fill(match[1]);
    await page.getByRole('button',{name:'Verificar correo',exact:true}).click();
    await page.waitForURL(running.base + '/');
    await page.getByLabel('Correo electrónico',{exact:true}).fill(correo);
    await page.getByLabel('Contraseña',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
    await page.waitForURL(running.base + '/inicio');
    const cookie = (await ctx.cookies()).find(c => c.name === 'haycupo_dev_session');
    assert.equal(cookie?.httpOnly,true);
    assert.equal(cookie?.sameSite,'Strict');
    await page.goto(running.base + '/perfil');
    await page.getByText('Correo verificado',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Editar perfil',exact:true}).click();
    await page.getByLabel('Ciudad',{exact:true}).fill('Ciudad de prueba');
    await page.getByLabel('Ocupación',{exact:true}).fill('Ocupación sintética');
    await page.getByLabel('Sobre mí (biografía)',{exact:true}).fill('Biografía sintética');
    await page.getByLabel('Fotografía',{exact:true}).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGNsYGhggAEmOAsvBwAzBAEI14KrBQAAAABJRU5ErkJggg==','base64')});
    await page.getByRole('img',{name:'Vista previa de fotografía'}).waitFor();
    await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
    await page.getByText('Perfil guardado correctamente.',{exact:true}).waitFor();
    await page.reload();
    await page.getByText('Ciudad de prueba',{exact:true}).waitFor();
    await page.getByText('Biografía sintética',{exact:true}).waitFor();
    await page.getByRole('img',{name:'Fotografía de Roomie manual sintético'}).evaluate(async image => { await image.decode(); });
    assert.deepEqual(await page.evaluate(() => ({local:{...localStorage},session:{...sessionStorage}})),{local:{},session:{}});
    assert.doesNotMatch(await page.evaluate(() => document.cookie), /haycupo.*session/);
    assert.deepEqual(external,[]);
    assert.deepEqual(errors,[]);
  } finally {
    if (browser) await browser.close();
    await running.stop();
  }
});

test('manual: EOF stops all services and removes all temporary data', { timeout: 90_000 }, async () => {
  const running = await session();
  await running.stop(null);
});

test('manual: SIGINT/Ctrl+C executes cleanup and removes all temporary data', { timeout: 90_000 }, async () => {
  const running = await session(true);
  await running.stop('interrupt');
});
