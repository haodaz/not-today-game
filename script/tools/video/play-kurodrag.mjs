// Verifies #133 in the real page: Kuro is carried by the mouse, stays where it is set down, and a plain click still calls it.
export default async function ({ ev, sleep, mark, has, send }) {
  for (let i = 0; i < 80 && (await has(".dlg-layer .story-mask")); i++) { await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); await sleep(0.5); }
  await sleep(0.8);
  const rect = async () => JSON.parse(await ev("(()=>{const e=document.querySelector('.hud-kuro .kuro-btn, .kpet-btn'); if(!e) return 'null'; const r=e.getBoundingClientRect(); return JSON.stringify({x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width)})})()"));
  const m = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse", ...extra });
  const a = await rect(); mark("home " + JSON.stringify(a));
  await m("mouseMoved", a.x, a.y, { buttons: 0 }); await m("mousePressed", a.x, a.y);
  for (let i = 1; i <= 24; i++) { await m("mouseMoved", Math.round(a.x + (520 - a.x) * i / 24), Math.round(a.y + (300 - a.y) * i / 24)); await sleep(0.05); if (i === 12) mark("mid-carry state " + (await ev("document.querySelector('[data-kuro-slot]')?.dataset.state")) + " carried=" + (await ev("document.documentElement.classList.contains('kuro-carried')"))); }
  await m("mouseReleased", 520, 300); await sleep(0.4);
  const b = await rect(); mark("set down " + JSON.stringify(b) + " state " + (await ev("document.querySelector('[data-kuro-slot]')?.dataset.state")) + " vars " + (await ev("document.documentElement.style.getPropertyValue('--kuro-dx')+','+document.documentElement.style.getPropertyValue('--kuro-dy')")) + " saved " + (await ev("localStorage.getItem('nt_kuro_at')")) + " chatOffer=" + (await ev("[...document.querySelectorAll('[data-action=loop-choice]')].filter(e=>e.getClientRects().length).length")));
  await sleep(2.2);
  await m("mouseMoved", b.x, b.y, { buttons: 0 }); await m("mousePressed", b.x, b.y); await m("mouseReleased", b.x, b.y); await sleep(1.2);
  mark("plain click → choices " + (await ev("JSON.stringify([...document.querySelectorAll('[data-action=loop-choice]')].filter(e=>e.getClientRects().length).map(e=>e.innerText.trim().slice(0,20)))")) + " box " + (await ev("(document.querySelector('.dlg .txt')?.innerText||'').slice(0,60)")));
  await sleep(1.5);
}
