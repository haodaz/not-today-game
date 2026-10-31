// The room splat in three.js (room-scene design S9, S11, S12). The only module that imports three
// and gaussian-splats-3d; the game reaches it by a dynamic import (splat/index.ts), so both libraries
// land in their own chunk, fetched after the first render. Never run in tests.
// Two viewers on two canvases: room_clean (always) and room_collapsed (from ring `room`), stacked;
// the layer sets the collapsed canvas's opacity to the ring's mix. Both viewers get `host` as their
// root element, and the canvases live in it, so everything stays inside the clipped stage box.
import { PerspectiveCamera, WebGLRenderer } from "three";
import { LogLevel, SceneFormat, SceneRevealMode, Viewer } from "@mkkellogg/gaussian-splats-3d";
import type { SplatScene } from "./layer";
import { lookOf, POSES, UP, type Pose } from "./pose";

export const SPLAT_URLS = { clean: "/room/room_clean.splat", collapsed: "/room/room_collapsed.splat" } as const;

interface One {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly viewer: Viewer;
  loaded: boolean;
}

function one(canvas: HTMLCanvasElement, host: HTMLElement): One {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 1);
  const camera = new PerspectiveCamera(POSES.room.fov ?? 50, 16 / 9, 0.05, 200);
  camera.up.set(UP.x, UP.y, UP.z);
  const viewer = new Viewer({
    selfDrivenMode: false,
    rootElement: host,
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
  if (p.fov !== undefined && p.fov !== o.camera.fov) {
    o.camera.fov = p.fov;
    o.camera.updateProjectionMatrix();
  }
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
  const host = doc.createElement("div");
  const canvases = [doc.createElement("canvas"), doc.createElement("canvas")] as const;
  host.append(canvases[0], canvases[1]);
  const clean = one(canvases[0], host);
  let collapsed: One | null = null;
  let collapsedLoad: Promise<void> | null = null;
  let size = { w: 1600, h: 900, r: 1 };
  const resize = (o: One) => {
    o.renderer.setPixelRatio(size.r);
    // CSS size stays the layer's (100 %), never the window's.
    o.renderer.setSize(size.w, size.h, false);
    o.camera.aspect = size.w / size.h;
    o.camera.updateProjectionMatrix();
  };
  resize(clean);
  await warm(clean, SPLAT_URLS.clean, win);
  return {
    host,
    canvases,
    ensureCollapsed() {
      if (!collapsedLoad) {
        collapsed = one(canvases[1], host);
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
