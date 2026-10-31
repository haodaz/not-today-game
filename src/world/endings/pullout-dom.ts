// The pull-out's frame driver (room-scene design S17): while `session.pullOut` is set, every frame
// writes `--island` and `--dark` on the page from the pure timeline. Works with or without the
// splat; the controller runs it after every render. No game state is touched.
import type { ActionContext } from "@world/desktop/controller";
import { darkKindOf } from "@world/room/splat/pullout";
import { pullFrameVars } from "./pullout";

export function createPullDriver(raf?: (fn: () => void) => number, cancel?: (id: number) => void) {
  return (root: HTMLElement, ctx: ActionContext) => {
    const win = root.ownerDocument.defaultView;
    const req = raf ?? ((fn: () => void) => win!.requestAnimationFrame(fn));
    const stop = cancel ?? ((id: number) => win!.cancelAnimationFrame(id));
    const now = () => ctx.now?.() ?? Date.now();
    let frame = 0;
    const tick = () => {
      frame = 0;
      const p = ctx.session.pullOut;
      if (!p) return;
      const page = root.querySelector<HTMLElement>(":scope > .pullout-page");
      if (page) {
        const vars = pullFrameVars(now() - p.startMs, p.from, darkKindOf(p.ending));
        for (const [k, v] of Object.entries(vars)) page.style.setProperty(k, v);
      }
      frame = req(tick);
    };
    return {
      after() {
        if (ctx.session.pullOut && !frame) frame = req(tick);
      },
      destroy() {
        if (frame) stop(frame);
        frame = 0;
      },
    };
  };
}
