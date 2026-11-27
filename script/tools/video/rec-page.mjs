// Record one page for N seconds: node rec-page.mjs <url> <out.mp4> <seconds> [js to run after load] 
// SCALE=1.2 → 1920×1080; SCALE=2 → 3200×1800 (for shots that get cropped). GPU=0 falls back to SwiftShader.
import { spawn } from "node:child_process"; import fs from "node:fs";
const [url, out, secs = "10", js = ""] = process.argv.slice(2);
// PLAY=<module.mjs>: its default export plays the page ({ ev, sleep, mark, has, click }) and the take ends when it returns (secs = the longest it may run)
const PLAY = process.env.PLAY ? (await import(process.env.PLAY)).default : null; const marks = [];
const FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", port = 9391, prof = `/tmp/nt-rec-${process.pid}`;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", ...(process.env.GPU === "0" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]), "--hide-scrollbars", "--mute-audio", "--disk-cache-size=1", `--remote-debugging-port=${port}`, `--window-size=1600,${process.env.WINH || 987}`, `--force-device-scale-factor=${Number(process.env.SCALE) || 1.2}`, "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000)); const bye = () => { try { chrome.kill("SIGKILL"); } catch {} try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} }; process.on("exit", bye);
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(0.25); } }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0, frames = 0, ff = null; const pending = new Map();
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } else if (j.method === "Page.screencastFrame") { send("Page.screencastFrameAck", { sessionId: j.params.sessionId }); if (ff) { frames++; ff.stdin.write(Buffer.from(j.params.data, "base64")); } } };
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
if (process.env.EMU) await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: Number(process.env.SCALE) || 1.2, mobile: false });
await send("Page.navigate", { url }); for (let i = 0; i < 60; i++) { if ((await ev("document.readyState")) === "complete") break; await sleep(0.25); }
await sleep(Number(process.env.WARM) || 2);
console.log("gpu:", await ev("(()=>{try{const c=document.createElement('canvas').getContext('webgl');const e=c.getExtension('WEBGL_debug_renderer_info');return c.getParameter(e.UNMASKED_RENDERER_WEBGL)}catch(e){return String(e)}})()"));
ff = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-use_wallclock_as_timestamps", "1", "-c:v", "mjpeg", "-i", "-", "-vf", "fps=30,crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "ignore", "inherit"] });
await send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1 });
const t0 = Date.now(); if (js) console.log("js:", await ev(js));
const mark = (m) => { const l = `${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}  ${m}`; marks.push(l); console.log(l); };
const has = (q) => ev(`[...document.querySelectorAll(${JSON.stringify(q)})].some(e=>e.getClientRects().length>0)`);
const click = (q, n = 0) => ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(q)})].filter(e=>e.getClientRects().length>0)[${n}]; if(!e) return false; e.click(); return true;})()`);
if (PLAY) await Promise.race([PLAY({ ev, sleep, mark, has, click, send }), sleep(Number(secs))]); else await sleep(Number(secs) - (Date.now() - t0) / 1000);
if (marks.length) fs.writeFileSync(out + ".marks.txt", marks.join("\n") + "\n");
await send("Page.stopScreencast"); await new Promise((r) => { ff.on("close", r); ff.stdin.end(); });
console.log(`frames ${frames} in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`); ws.close(); process.exit(0);
