// Each old object taken in hand in turn: 物品 → pick → 拿起来 → the drawn device with its real buttons, a few seconds, a key pressed, put back.
export default async function ({ ev, sleep, mark, has, click, send }) {
  const read = async (n = 80) => { for (let i = 0; i < n && (await has(".dlg-layer .story-mask, .objbar-host .story-mask")); i++) { await ev("(document.querySelector('.objbar-host .story-mask')||document.querySelector('.dlg-layer .story-mask'))?.click()"); await sleep(0.5); } };
  const acts = () => ev("JSON.stringify([...document.querySelectorAll('button,[role=button]')].filter(e=>e.getClientRects().length).map(b=>(b.dataset.action||'')+(b.dataset.id?':'+b.dataset.id:'')+(b.dataset.key?':'+b.dataset.key:'')).filter((v,i,a)=>v&&a.indexOf(v)===i))");
  const esc = async () => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); };
  await read(); await sleep(0.8);
  const ids = (process.env.OBJ || "chick,camera,pager,iccard,tape,dictionary,calculator,phone").split(",");
  for (const id of ids) {
    if (!(await has("[data-action=items-pick]"))) { await click("[data-action=items-toggle]"); await sleep(1.0); }
    const k = await ev(`[...document.querySelectorAll('[data-action=items-pick]')].filter(e=>e.getClientRects().length).findIndex(e=>(e.dataset.id||e.dataset.object||e.getAttribute('aria-label')||e.innerHTML).includes(${JSON.stringify(id)}))`);
    await click("[data-action=items-pick]", Math.max(0, k)); await sleep(0.8);
    const held = await click(`[data-action=loop-hold][data-id=${id}]`) || await click("[data-action=loop-hold]"); await sleep(1.2); await read(8);
    mark(`in hand ${id} (${held}) · ` + (await acts()).slice(0, 420)); await sleep(1.6);
    const keys = await ev("[...document.querySelectorAll('[data-action=obj-key]')].filter(e=>e.getClientRects().length).length");
    for (let j = 0; j < (process.env.KEYS === "0" ? 0 : Math.min(keys || 0, 3)); j++) { await click("[data-action=obj-key]", j); await sleep(0.9); await read(4); }
    await sleep(Number(process.env.HOLD) || 1.5); mark(`out ${id}`);
    await esc(); await sleep(0.8); await read(6); if (await has("[data-action=obj-key]")) { await esc(); await sleep(0.6); }
  }
  mark("end");
}
