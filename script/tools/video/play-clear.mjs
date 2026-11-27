// Reads away whatever lines are up (quickly), then holds the clean view for HOLD seconds.
export default async function ({ ev, sleep, mark, has }) {
  for (let i = 0; i < 80 && (await has(".dlg-layer .story-mask")); i++) { await ev("document.querySelector('.dlg-layer .story-mask')?.click()"); await sleep(0.5); }
  await sleep(0.6); mark("clean"); await sleep(Number(process.env.HOLD) || 6);
}
