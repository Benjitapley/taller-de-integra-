/** Build the current sources without project dotenv files or inherited credentials. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, rm, symlink, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const isolated = await mkdtemp(join(project, ".proxy-test-build-"));
let linked = false;
try {
  for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) {
    await cp(join(project, name), join(isolated, name), { recursive: true });
  }
  await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  linked = true;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
  const child = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "build"], {
    cwd: isolated, windowsHide: true, stdio: "inherit",
    env: { ...env, NEXT_TELEMETRY_DISABLED: "1", FASTAPI_ORIGIN: "http://127.0.0.1:8000", NODE_OPTIONS: `--require=${fileURLToPath(new URL("../../tests/e2e/network-guard.cjs", import.meta.url))}` },
  });
  const [code] = await once(child, "exit");
  process.exitCode = code === 0 ? 0 : 1;
} finally {
  if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-build-")) throw new Error("Unsafe build cleanup path");
  if (linked) await unlink(join(isolated, "node_modules"));
  await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
