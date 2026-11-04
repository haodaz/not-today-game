// ide R3: "the iframe reloads only when the URL changes". The desktop re-renders by replacing the
// root's HTML, which would reload every iframe on every render. An iframe marked `data-keep="<key>"`
// is parked outside the root across the render and put back in place of its new copy when the copy
// has the same `src`. Moving an iframe keeps it loaded only with `moveBefore` (the state-preserving
// move); where the browser lacks it, nothing is kept and the new copy loads as before.

type Mover = { moveBefore?: (node: Node, child: Node | null) => void };

export interface FrameKeeper {
  /** Before the root's HTML is replaced: park the kept iframes. */
  before(root: HTMLElement): void;
  /** After: put each parked iframe back where its same-src copy is; drop the rest. */
  after(root: HTMLElement): void;
}

export function createFrameKeeper(doc: Document = document): FrameKeeper {
  let park: HTMLElement | null = null;
  const canMove = (parent: Node): boolean => typeof (parent as unknown as Mover).moveBefore === "function";
  const move = (parent: Node, node: Node, ref: Node | null) => (parent as unknown as Required<Mover>).moveBefore(node, ref);
  return {
    before(root) {
      const frames = [...root.querySelectorAll<HTMLIFrameElement>("iframe[data-keep]")];
      if (frames.length === 0) return;
      if (!park) {
        park = doc.createElement("div");
        park.setAttribute("aria-hidden", "true");
        park.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden";
        doc.body.appendChild(park);
      }
      if (!canMove(park)) return;
      for (const f of frames) move(park, f, null);
    },
    after(root) {
      if (!park || park.childElementCount === 0) return;
      for (const copy of root.querySelectorAll<HTMLIFrameElement>("iframe[data-keep]")) {
        const old = [...park.children].find((f) => (f as HTMLElement).dataset.keep === copy.dataset.keep) as HTMLIFrameElement | undefined;
        if (!old || old.getAttribute("src") !== copy.getAttribute("src") || !copy.parentNode || !canMove(copy.parentNode)) continue;
        move(copy.parentNode, old, copy);
        copy.remove();
      }
      park.replaceChildren();
    },
  };
}
