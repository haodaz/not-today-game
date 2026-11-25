// Headless walk into the fight's second phase; shots along the way.
import { spawn } from "node:child_process";
import fs from "node:fs";
const out = process.argv[2];
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", port = 9395, prof = "/tmp/nt-p2b";
fs.rmSync(prof, { recursive: true, force: true });
const chrome = spawn(CHROME, ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", "--mute-audio", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch {} });
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(0.25); } }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 }); fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(r.result.data, "base64")); };
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:5173/?lang=zh&day=18&boss=survive&found=chick,camera,pager,tape&bosshp=0.02&splat=0&fx=0" });
await sleep(6);
const log = [];
// let the room frame come up before the first bar is emptied: step the intro, then wait for the host to say ready (or 14 s)
for (let i = 0; i < 40; i++) { const st = await ev(`(() => { const m = document.querySelector('.bs-menu'); if (m) return 'menu'; const h = document.querySelector('.bs-hit'); if (h) { h.click(); return 'hit'; } return 'wait'; })()`); if (st === 'menu') break; await sleep(0.35); }
for (let i = 0; i < 28; i++) { const fr = await ev(`(() => { const f = [...document.querySelectorAll('iframe')].find((x) => /room3d/.test(x.src)); return f ? 'frame' : 'none'; })()`); log.push(fr); if (i > 20) break; await sleep(0.5); }
for (let i = 0; i < 200; i++) {
  const st = await ev(`(() => { const p = document.querySelector('.boss-page'); if (!p) return 'nopage'; if (p.classList.contains('dislocating') || p.classList.contains('final') || document.querySelector('.bs-bossbar.stage2')) return 'P2:' + p.className; const m = document.querySelector('.bs-menu'); if (m) { const c = [...m.querySelectorAll('.bs-cmd.hit')].pop() || m.querySelector('.bs-cmd'); c.click(); return 'cmd'; } const h = document.querySelector('.bs-hit'); if (h) { h.click(); return 'hit'; } return 'wait:' + p.dataset.phase; })()`);
  if (String(st).startsWith('P2')) { log.push(st); break; }
  await sleep(0.3);
}
log.push('at P2: ' + await ev(`document.querySelector('.boss-page')?.className`));
await sleep(0.5); await shot("p2-0");
await sleep(1.0); await shot("p2-1-turning");
await sleep(2.2); await shot("p2-2-after-turn");
await sleep(3.0); await shot("p2-2b-rising");
await sleep(4.5); await shot("p2-3-risen");
log.push(await ev(`document.querySelector('.boss-page')?.className + ' | frame=' + !!document.querySelector('iframe')`));
for (let i = 0; i < 40; i++) { const st = await ev(`(() => { const m = document.querySelector('.bs-menu'); if (m) return 'menu'; const h = document.querySelector('.bs-hit'); if (h) { h.click(); return 'hit'; } return 'wait'; })()`); if (st === 'menu') break; await sleep(0.4); }
await sleep(0.6); await shot("p2-4-menu");
// play phase 2 on: our hit (the world is hurt), the boss's act (the world strikes), then to the win and the pull-out
let hurtShot = false, strikeShot = false;
for (let i = 0; i < 400; i++) {
  const st = await ev(`(() => { const p = document.querySelector('.boss-page'); if (!p) return 'gone'; const f = document.querySelector('.bs-field'); const ph = p.dataset.phase || ''; if (p.classList.contains('after') || ph === 'won' || ph === 'after' || ph === 'lost') return 'END:' + p.className + ':' + ph; const who = f && f.dataset.who; if (who === 'boss') return 'bossact'; if (who) return 'ouract'; const m = document.querySelector('.bs-menu'); if (m) { const c = [...m.querySelectorAll('.bs-cmd.hit')].pop() || m.querySelector('.bs-cmd'); c.click(); return 'cmd'; } const h = document.querySelector('.bs-hit'); if (h) { h.click(); return 'hit'; } return 'wait'; })()`);
  if (st === 'ouract' && !hurtShot) { await sleep(0.45); await shot("p2-5-we-hit"); hurtShot = true; }
  if (st === 'bossact' && !strikeShot) { await sleep(0.4); await shot("p2-6-it-strikes"); strikeShot = true; }
  if (String(st).startsWith('END') || st === 'gone') { log.push(st); break; }
  await sleep(0.2);
}
await sleep(1.2); await shot("w1-leave-1s");
await sleep(2.0); await shot("w2-leave-3s");
log.push('leave: ' + await ev(`document.querySelector('.boss-page')?.className`));
// the outro lines, one click each, until the page is condensing
for (let i = 0; i < 60; i++) { const st = await ev(`(() => { const p = document.querySelector('.boss-page'); if (!p) return 'gone'; if (p.classList.contains('condensing')) return 'COND'; const h = document.querySelector('.bs-hit'); if (h) { h.click(); return 'hit:' + (document.querySelector('.bs-box')?.textContent || '').trim().slice(0, 30); } return 'wait'; })()`); log.push(st); if (st === 'COND' || st === 'gone') break; await sleep(1.6); if (i === 2) await shot("w3-outro"); }
await sleep(4); await shot("w4-cond-4s");
await sleep(4); await shot("w5-cond-8s");
await sleep(5.5); await shot("w6-cond-13s");
log.push(await ev(`document.querySelector('.boss-page')?.className + ' | ' + (document.querySelector('.bs-box')?.textContent || '').trim().slice(0, 60)`));
fs.writeFileSync(`${out}/log.txt`, log.join("\n")); ws.close(); process.exit(0);
