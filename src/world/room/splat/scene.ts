// The room splat in three.js (room-scene design S9, S11). The only module that imports three and
// gaussian-splats-3d; the game reaches it by a dynamic import from main.ts's splat loader, so both
// libraries land in their own chunk, fetched after the first render. Never run in tests.
// Two viewers on two canvases: room_clean (always) and room_collapsed (from ring `room`), stacked;
// the layer sets the collapsed canvas's opacity to the ring's mix.
import { PerspectiveCamera, WebGLRenderer } from "three";
import { LogLevel, SceneFormat, SceneRevealMode, Viewer } from "@mkkellogg/gaussian-splats-3d";
import type { SplatScene } from "./layer";
import { lookOf, POSES, UP, type Pose } from "./pose";

export const SPLAT_URLS = { clean: "/room/room_clean.splat", collapsed: "/room/room_collapsed.splat" } as const;
/** Provisional until measured against the photos in a browser (the capture's lens is unknown). */
export const FOV_DEG = 50;

interface One {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly viewer: Viewer;
  loaded: boolean;
}

function one(canvas: HTMLCanvasElement): One {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 1);
  const camera = new PerspectiveCamera(FOV_DEG, 16 / 9, 0.05, 200);
  camera.up.set(UP.x, UP.y, UP.z);
  const viewer = new Viewer({
    selfDrivenMode: false,
    renderer,
    camera,
    useBuiltInControls: false,
    // No COOP/COEP headers on the static host: no SharedArrayBuffer.
    sharedMemoryForWorkers: false,
    gpuAcceleratedSort: false,
    ignoreDevicePixelRatio: true,
    sceneRevealMode: SceneRevealMode.Instant,
    logLevel: LogLevel.None,
    dynamicScene: false,
  });
  return { renderer, camera, viewer, loaded: false };
}

function aim(o: One, p: Pose): void {
  const l = lookOf(p);
  o.camera.position.set(p.pos.x, p.pos.y, p.pos.z);
  o.camera.lookAt(l.x, l.y, l.z);
}

function draw(o: One, p: Pose): void {
  aim(o, p);
  o.viewer.update();
  o.viewer.render();
}

const frame = (win: Window) => new Promise<void>((r) => win.requestAnimationFrame(() => r()));

/** Load one splat and draw it a few times, nudged, off-screen: the sort worker's first frame can be black (FR1). */
async function warm(o: One, url: string, win: Window): Promise<void> {
  await o.viewer.addSplatScene(url, { showLoadingUI: false, progressiveLoad: false, format: SceneFormat.Splat });
  const p = POSES.room;
  for (const dx of [0.001, -0.001, 0]) {
    draw(o, { ...p, pos: { ...p.pos, x: p.pos.x + dx } });
    await frame(win);
  }
  o.loaded = true;
}

export async function createSplatScene(doc: Document): Promise<SplatScene> {
  const win = doc.defaultView!;
  const canvases = [doc.createElement("canvas"), doc.createElement("canvas")] as const;
  const clean = one(canvases[0]);
  let collapsed: One | null = null;
  let collapsedLoad: Promise<void> | null = null;
  let size = { w: 1600, h: 900, r: 1 };
  const resize = (o: One) => {
    o.renderer.setPixelRatio(size.r);
    o.renderer.setSize(size.w, size.h, false);
    o.camera.aspect = size.w / size.h;
    o.camera.updateProjectionMatrix();
  };
  resize(clean);
  await warm(clean, SPLAT_URLS.clean, win);
  return {
    canvases,
    ensureCollapsed() {
      if (!collapsedLoad) {
        collapsed = one(canvases[1]);
        resize(collapsed);
        collapsedLoad = warm(collapsed, SPLAT_URLS.collapsed, win);
      }
      return collapsedLoad;
    },
    setSize(w, h, r) {
      size = { w, h, r };
      resize(clean);
      if (collapsed) resize(collapsed);
    },
    render(pose, mix) {
      draw(clean, pose);
      if (collapsed?.loaded && mix > 0) draw(collapsed, pose);
    },
    dispose() {
      for (const o of [clean, collapsed]) {
        if (!o) continue;
        void Promise.resolve(o.viewer.dispose()).catch(() => {});
        o.renderer.dispose();
      }
    },
  };
}
