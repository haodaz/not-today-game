// A task's launch page, then the first seconds of its game: reads the lines in the way, holds on the poster, starts, presses arrows.
export default async function ({ ev, sleep, mark, has, click, send }) {
  const key = async (k, code, vk) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };
  for (let i = 0; i < 30 && (await has(".dlg-layer .story-mask")); i++) { await sleep(0.9); await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); await sleep(0.35); }
  mark("poster · " + (await ev("(document.querySelector('.launch, .launch-page, [class*=launch]')?.innerText||'').replace(/\\s+/g,' ').slice(0,100)")));
  await sleep(Number(process.env.POSTER) || 4);
  const started = await click("[data-action=task-launch]"); mark("start " + started); await sleep(1.2);
  for (let i = 0; i < 12 && (await has(".dlg-layer .story-mask")); i++) { await sleep(1.0); await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); await sleep(0.35); }
  if (await click("[data-action=work-start]")) { mark("work-start"); await sleep(1); }
  for (let i = 0; i < 12 && (await has(".dlg-layer .story-mask")); i++) { await sleep(1.0); await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); await sleep(0.35); }
  mark("game · " + (await ev("JSON.stringify([...document.querySelectorAll('button,[role=button]')].filter(e=>e.getClientRects().length).map(b=>(b.dataset.action||'')).filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,24))")));
  const seq = [["ArrowRight", 39], ["ArrowDown", 40], ["ArrowLeft", 37], ["ArrowUp", 38], ["ArrowRight", 39], ["ArrowRight", 39], ["ArrowDown", 40], ["ArrowLeft", 37]];
  const n = Math.round((Number(process.env.GAME) || 9) / 0.45);
  for (let i = 0; i < n; i++) { const [k, vk] = seq[i % seq.length]; await key(k, k, vk); await sleep(0.45); if (await has(".dlg-layer .story-mask")) { await sleep(0.8); await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); } }
  mark("end");
}
