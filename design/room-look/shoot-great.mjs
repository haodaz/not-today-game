// Headless (real GPU) shots of the room3d page alone: node shoot-room.mjs <outdir> '<json steps>'  steps: [{cmd:{...}, wait:sec, shot:"name"}]
import { spawn } from "node:child_process";
import fs from "node:fs";
const out = process.argv[2], steps = JSON.parse(process.argv[3]);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", port = 9394, prof = "/tmp/nt-room";
fs.rmSync(prof, { recursive: true, force: true });
const chrome = spawn(CHROME, ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", "--mute-audio", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(0.25); } }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:5173/room3d/index.html?embed=1&day=18&great=1" });
for (let i = 0; i < 60; i++) { if (await ev("!!window.proto")) break; await sleep(0.5); }
await sleep(2);
const log = [];
for (const s of steps) {
  if (s.cmd) await ev(`proto.command(${JSON.stringify(s.cmd)})`);
  await sleep(s.wait ?? 1);
  if (s.shot) { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 }); fs.writeFileSync(`${out}/${s.shot}.jpg`, Buffer.from(r.result.data, "base64")); log.push(s.shot + " k=" + await ev("proto.FAR.k.toFixed(2) + ' r=' + proto.BOSS.r.toFixed(2) + ' ' + document.getElementById('perf').textContent")); }
}
fs.writeFileSync(`${out}/log.txt`, log.join("\n")); ws.close(); process.exit(0);
