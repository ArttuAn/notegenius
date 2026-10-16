// Run after building. No authenticated model or URL-import requests are made.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

const probe = net.createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const password = "integration-only-" + "p".repeat(32);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: { ...process.env, NOTEGENIUS_PASSWORD: password, NOTEGENIUS_USERNAME: "admin", NOTEGENIUS_ORIGIN: "", CLAUDE_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });
const origin = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).status === 401) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error("Server exited before readiness");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, "server readiness");
  for (const path of ["/api/notebooks", "/api/settings", "/api/chat/sessions", "/api/sources/test", "/api/generate"]) {
    assert.equal((await fetch(origin + path)).status, 401, path);
    assert.equal((await fetch(origin + path, { headers: { "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" } })).status, 401, path);
  }
  assert.equal((await fetch(origin + "/api/chat", { method: "POST", body: "{}" })).status, 401);
  const authorization = `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
  const notebooks = await fetch(origin + "/api/notebooks", { headers: { authorization } });
  assert.equal(notebooks.status, 200);
  assert.ok(Array.isArray(await notebooks.json()));
  const forbidden = await fetch(origin + "/api/chat", { method: "POST", headers: { authorization, origin: "https://evil.example" }, body: "{}" });
  assert.equal(forbidden.status, 403);
  assert.equal((await fetch(origin + "/notebooks", { headers: { authorization } })).status, 200);
  console.log("Actual Next server auth integration passed: anonymous and forged-subrequest API calls rejected, authenticated owner allowed, cross-origin paid request denied. No model or source fetch calls made.");
} catch (error) {
  console.error(logs.slice(-3000));
  throw error;
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null) await once(child, "exit");
}
