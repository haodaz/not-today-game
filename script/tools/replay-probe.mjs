// Look at a headless replay from outside: attach to the Chrome the driver started (its debugging
// port, 9334 + day) and print the page's state — the stage, the task card's current line, the box,
// the visible actions — or evaluate one expression. Never clicks anything.
//   node script/tools/replay-probe.mjs <port> [expression]
//   node script/tools/replay-probe.mjs <port> --shot <file.jpg>   (a small jpeg, quality 40)
import fs from "node:fs";

const [port = "9335", arg, file] = process.argv.slice(2);
const pages = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) (pending.get(j.id)(j), pending.delete(j.id));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++n; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

if (arg === "--shot") {
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 40 });
  fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
  console.log(`saved ${file}`);
} else {
  const STATE = `(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const stage = document.querySelector('.stage');
    const line = document.querySelector('.hud-left .it.now, .hud-left [data-id], .list .it.now');
    const dlg = [...document.querySelectorAll('.dlg .txt, .dlg p')].map((x) => x.innerText).join(' | ');
    const acts = [...new Set([...document.querySelectorAll('[data-action]')].filter(vis).map((e) => e.dataset.action + (e.dataset.view ? ':' + e.dataset.view : '') + (e.dataset.guide === 'on' ? '*' : '')))];
    return JSON.stringify({ stage: stage && stage.className, view: stage && stage.dataset.view, line: line && line.innerText.replace(/\\s+/g, ' '), dlg: dlg.slice(0, 200), choices: [...document.querySelectorAll('[data-action=loop-choice]')].filter(vis).map((e) => e.innerText.trim()), acts }, null, 1);
  })()`;
  const r = await send("Runtime.evaluate", { expression: arg || STATE, returnByValue: true, awaitPromise: true });
  console.log(r.result?.result?.value ?? JSON.stringify(r.result));
}
ws.close();
process.exit(0);
