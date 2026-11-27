// Verifies #128 in the real page: the dictionary in hand shows the card with Kuro's lines; a line typed on its keys is
// looked up (the word-by-word Chinese), and looked up again (what it reads back as).
export default async function ({ ev, sleep, mark, has, click }) {
  const read = async (n = 80) => { for (let i = 0; i < n && (await has(".dlg-layer .story-mask, .objbar-host .story-mask")); i++) { await ev("(document.querySelector('.objbar-host .story-mask')||document.querySelector('.dlg-layer .story-mask'))?.click()"); await sleep(0.5); } };
  await read(); await click("[data-action=items-toggle]"); await sleep(1.0); await click("[data-action=items-pick]", 0); await sleep(0.9);
  await ev("(()=>{const all=[...document.querySelectorAll('[data-action=loop-hold]')].filter(e=>e.getClientRects().length); const b=all[all.length-1]; if(b) b.click(); return all.length})()"); await sleep(2.0); await read(8);
  for (let i = 0; i < 4 && (await has("[data-action=dict-guide-ok]")); i++) { await click("[data-action=dict-guide-ok]"); await sleep(0.6); }
  mark("acts " + (await ev("JSON.stringify([...document.querySelectorAll('button,[role=button]')].filter(e=>e.getClientRects().length).map(b=>(b.dataset.action||'')+(b.dataset.key?':'+b.dataset.key:'')).filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,40))")));
  if (await click("[data-action=obj-use]")) { mark("use"); await sleep(1.5); await read(6); for (let i = 0; i < 4 && (await has("[data-action=dict-guide-ok]")); i++) { await click("[data-action=dict-guide-ok]"); await sleep(0.6); } }
  const keysNow = await ev("JSON.stringify([...document.querySelectorAll('[data-action=obj-key]')].filter(e=>e.getClientRects().length).map(e=>e.dataset.key))");
  mark("card: " + (await ev("(document.querySelector('.dict-lines')?.innerText||'NO CARD').replace(/\\s+/g,' | ')")) + " · keys " + keysNow.slice(0, 160));
  const key = async (k) => { const ok = await click(`[data-action=obj-key][data-key="${k}"]`); await sleep(0.13); return ok; };
  if (!(await has("[data-action=obj-key][data-key=G]"))) { await key("open"); await sleep(0.6); await key("power"); await sleep(0.4); }
  let typed = 0; for (const ch of (process.env.LINE || "good to see you keep going")) { if (await key(ch === " " ? "space" : ch.toUpperCase())) typed++; }
  mark("typed " + typed + " keys"); await sleep(1.2);
  await key("lookup"); await sleep(1.8); mark("first press"); await key("lookup"); await sleep(1.8); mark("second press"); await sleep(0.8);
}
