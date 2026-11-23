// Standing figures' idle loops (texture-pass R2, player-stands): a loop plays once, rests, then plays
// again (author 2026-11-22: 先循环一次，然后停 10 秒左右再下一次, otherwise the motion reads as fidgeting).
// `ended` does not bubble, so one capturing listener on the document serves every figure, including
// ones re-rendered later; a figure removed in the meantime is simply not played.
export const IDLE_REST_MS = 10_000;

export function watchIdleLoops(doc: Document, restMs = IDLE_REST_MS): () => void {
  const onEnded = (e: Event) => {
    const v = e.target as HTMLVideoElement | null;
    if (!v || v.tagName !== "VIDEO" || !v.classList.contains("scene-stand-anim")) return;
    setTimeout(() => {
      if (!v.isConnected) return;
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }, restMs);
  };
  doc.addEventListener("ended", onEnded, true);
  return () => doc.removeEventListener("ended", onEnded, true);
}
