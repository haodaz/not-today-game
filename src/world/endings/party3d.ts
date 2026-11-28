// The fight's party as solid pixel figures (author 2026-11-28, on the fight's page: 「人物目前效果不细致，所有人物和老物件都很
// 粗糙，边缘也粗糙；然后在整个空间里显不出人物效果」; 「cto的效果里面，人物3d但是接近pixel，而且还有打击崩出pixel块的，特别好」;
// and the engine she pointed at, loktar00.github.io/sprite-stack-engine: a thing as a stack of pixel slices, the way a
// printer lays them down; 「优化这个的人物质感、空间设计（你不一定需要站成一串」).
//
// What was rough: the figures' files are enlargements of pixel pictures, shown at sizes that are no whole multiple of
// their pixels, so every edge fell between two pixels. Here each file is read back to its own pixels (the colour most
// of a cell has), and those pixels are built into a solid: each is a bar running back from the picture's face, long in
// the middle of a shape and short at its outline. The solids are drawn small (one of their pixels to one of the
// canvas's) and the canvas is shown enlarged without smoothing, so a figure keeps hard, even pixels however it turns.
// They are lit: the lamp's warm light, the boss's red from the right, a cool dark for the rest. A blow knocks blocks
// out: its own pixels off a figure that is struck, pieces of his hide where one of them lands a hit.
//
// The page's own markup stays the one truth: this layer draws, for every `.bs-member`, the picture its <img> names, at
// the place that <img> is (the page's own lunges and jolts carry the figure with them), and reads the member's
// classes (acting, hurt, down, ready). The <img>s are kept in the page and not shown (`.p3d`); with no WebGL nothing
// is hidden and the page is as before. Built the way the Caelune lookdev lab builds its voxel things
// (github.com/bigdrum/caelune2), rewritten here.
import type { ActionContext } from "@world/desktop/controller";

type Hook = { after(): void; destroy(): void };
// three has no type declarations in this repo (room/splat/vendor.d.ts names the two things the splat uses): it is used loosely here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type T3 = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = any;

/** The stage the page is laid out on, and the canvas's own size: one canvas pixel is one of a figure's pixels. */
const STAGE_W = 1600, STAGE_H = 900, PX = 2.5, CW = STAGE_W / PX, CH = STAGE_H / PX;
/** The stage's pivot (the middle of the ground the party stands on), how far it is tipped toward the eye, and his height (160 of his pixels, two of the canvas's each). */
const PIVOT_X = 800, PIVOT_Y = 150, TIP = 0.2, BOSS_H = 800;
// The place itself (author 2026-11-28, dragging the first build: 「目前空间没有移动，只有这一堆人能移动了，克总是纸片移动，不是3d
// 移动视角」). The fight's painted backdrop is stood up in the same space as two sheets: what is above its ground line is
// the far wall, what is below it is laid down as the floor, running from the wall toward the eye. Seen from the eye's own
// place the two are exactly the painting; turned, they are a room's corner, and everyone stands on that floor.
const HORIZON = 342 /* the painting's ground line, up from its bottom edge */, WALL_Z = -700;
const FLOOR_Y = ((HORIZON - PIVOT_Y) + WALL_Z * Math.sin(TIP)) / Math.cos(TIP), FLOOR_NEAR = (FLOOR_Y * Math.cos(TIP) + PIVOT_Y) / Math.sin(TIP);
const WALL_TOP = ((STAGE_H - PIVOT_Y) + WALL_Z * Math.sin(TIP)) / Math.cos(TIP), BOSS_Z = -80;
const BACKDROP = "/battle/boss-bg.jpg";

/** How a figure is built from its picture: `cell` the picture's own pixel in file pixels; `half` its greatest thickness each side of the middle, in its pixels; `round` how fast it thickens from its outline (1 a ball, 3 a box with a bevel). */
interface Kind { readonly cell: number; readonly half: number; readonly round: number; readonly waist: number; /** how solid a pixel must be to count (0–255; default 128): his picture has smoke and glow round it that are not him */ readonly solid?: number; /** its back is its case (the colour most of it has), not its face mirrored */ readonly plainBack?: boolean }
// Real thickness (author 2026-11-28, on the slab build: 「目前人物都是加厚的纸片，而不是3d」): each swells from its outline to
// its middle as far as the thing itself is thick (the chick is an egg, the pager a box, an arm a tube), and a device's
// back is its own case, not its face again. (The build before that drew them small and enlarged: a step of thickness
// was then less than a pixel wide, which is what crawled, 「像素看起来在竖着刷新」. They are drawn at their own size now.)
const KINDS: Readonly<Record<string, Kind>> = {
  player: { cell: 2, half: 8, round: 1.3, waist: 0.46 },
  chick: { cell: 3, half: 15, round: 1, waist: 0.3 },
  camera: { cell: 3, half: 13, round: 1.6, waist: 0.3, plainBack: true },
  pager: { cell: 3, half: 10, round: 2, waist: 0.3, plainBack: true },
  iccard: { cell: 3, half: 2, round: 2, waist: 0.3, plainBack: true },
  tape: { cell: 3, half: 9, round: 2, waist: 0.3, plainBack: true },
  dictionary: { cell: 3, half: 8, round: 2, waist: 0.3, plainBack: true },
  calculator: { cell: 3, half: 5, round: 2, waist: 0.3, plainBack: true },
  phone: { cell: 3, half: 5, round: 2, waist: 0.3, plainBack: true },
  qkuro: { cell: 3, half: 12, round: 1.2, waist: 0.3 },
  // him (「克总也能做3d堆叠了」): the fight's own picture of him, thick as a head is; he does not breathe
  boss: { cell: 3, half: 40, round: 1, waist: 9, solid: 235 },
};

export interface Cells { readonly gw: number; readonly gh: number; readonly col: Int32Array }

/**
 * A picture read back to its own pixels: for each cell the colour most of it has (an average would be a smear), empty
 * where less than half of it is filled; the grid is laid at whichever offset the picture agrees with best. Pure.
 */
export function readCells(w: number, h: number, d: Uint8ClampedArray | readonly number[], cell: number, solidAt = 128): Cells {
  const read = (ox: number, oy: number, keep: boolean) => {
    const gw = Math.ceil((w + ox) / cell), gh = Math.ceil((h + oy) / cell), out = keep ? new Int32Array(gw * gh).fill(-1) : null;
    let bad = 0;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const cnt = new Map<number, [number, number, number, number]>();
      let solid = 0, n = 0;
      for (let y = gy * cell - oy; y < gy * cell - oy + cell; y++) for (let x = gx * cell - ox; x < gx * cell - ox + cell; x++) {
        n++;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const k = (y * w + x) * 4;
        if (d[k + 3]! < solidAt) continue;
        solid++;
        const key = ((d[k]! >> 4) << 8) | ((d[k + 1]! >> 4) << 4) | (d[k + 2]! >> 4), e = cnt.get(key);
        if (e) { e[0]++; e[1] += d[k]!; e[2] += d[k + 1]!; e[3] += d[k + 2]!; } else cnt.set(key, [1, d[k]!, d[k + 1]!, d[k + 2]!]);
      }
      if (solid * 2 < n) { bad += solid; continue; }
      let best: [number, number, number, number] | null = null;
      for (const e of cnt.values()) if (!best || e[0] > best[0]) best = e;
      bad += n - best![0];
      if (out) out[gy * gw + gx] = (Math.round(best![1] / best![0]) << 16) | (Math.round(best![2] / best![0]) << 8) | Math.round(best![3] / best![0]);
    }
    return { gw, gh, out, bad };
  };
  let at: [number, number] = [0, 0], low = Infinity;
  for (let oy = 0; oy < cell; oy++) for (let ox = 0; ox < cell; ox++) { const r = read(ox, oy, false); if (r.bad < low) { low = r.bad; at = [ox, oy]; } }
  const g = read(at[0], at[1], true);
  return { gw: g.gw, gh: g.gh, col: g.out! };
}

/** How thick each cell is each side of the middle (0 where empty): thin at the outline, `half` at most. Pure. */
export function cellDepths(c: Cells, kind: Pick<Kind, "half" | "round">): Int16Array {
  const { gw, gh, col } = c, dist = new Int16Array(gw * gh), q: number[] = [];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? -1 : col[y * gw + x]!);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (at(x, y) >= 0 && (at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0)) { dist[y * gw + x] = 1; q.push(x, y); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i]!, y = q[i + 1]!, dd = dist[y * gw + x]!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) if (at(nx, ny) >= 0 && !dist[ny * gw + nx]) { dist[ny * gw + nx] = dd + 1; q.push(nx, ny); }
  }
  const out = new Int16Array(gw * gh);
  for (let i = 0; i < out.length; i++) out[i] = col[i]! < 0 ? 0 : Math.max(1, Math.min(kind.half, Math.round(dist[i]! * kind.round)));
  return out;
}

/** The solid's faces as flat arrays (position, normal, colour 0–255, index). One unit is one cell; the feet are at y 0, the middle at x 0 and z 0. Pure. */
export function solidArrays(c: Cells, depth: Int16Array, plainBack = false): { pos: number[]; nor: number[]; col: number[]; idx: number[] } {
  const { gw, gh } = c, pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  // the colour most of it has: a device's case
  let body = 0x808080;
  if (plainBack) { const cnt = new Map<number, number>(); let top = 0; for (const v of c.col) { if (v < 0) continue; const k = v & 0xf0f0f0, n = (cnt.get(k) ?? 0) + 1; cnt.set(k, n); if (n > top) { top = n; body = v; } } }
  const half = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : depth[y * gw + x]!);
  const quad = (p: readonly number[], n: readonly [number, number, number], rgb: number, k: number) => {
    const v = pos.length / 3;
    pos.push(...p);
    for (let i = 0; i < 4; i++) { nor.push(...n); col.push(((rgb >> 16) & 255) * k, ((rgb >> 8) & 255) * k, (rgb & 255) * k); }
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const hd = half(x, y);
    if (!hd) continue;
    const rgb = c.col[y * gw + x]!, X0 = x - gw / 2, X1 = X0 + 1, Y1 = gh - y, Y0 = Y1 - 1;
    quad([X0, Y0, hd, X1, Y0, hd, X1, Y1, hd, X0, Y1, hd], [0, 0, 1], rgb, 1); // its face: the picture
    quad([X1, Y0, -hd, X0, Y0, -hd, X0, Y1, -hd, X1, Y1, -hd], [0, 0, -1], plainBack && hd > 1 ? body : rgb, plainBack ? 0.85 : 0.6); // its back: its case; or the same picture, darker
    for (const [dx, dy, n] of [[-1, 0, [-1, 0, 0]], [1, 0, [1, 0, 0]], [0, -1, [0, 1, 0]], [0, 1, [0, -1, 0]]] as const) {
      const nh = half(x + dx, y + dy);
      if (nh >= hd) continue; // its side shows only where it stands out past the cell beside it
      for (const [za, zb] of nh === 0 ? [[-hd, hd]] : [[nh, hd], [-hd, -nh]]) {
        if (dx) { const X = dx < 0 ? X0 : X1; quad(dx < 0 ? [X, Y0, za!, X, Y0, zb!, X, Y1, zb!, X, Y1, za!] : [X, Y0, zb!, X, Y0, za!, X, Y1, za!, X, Y1, zb!], n, rgb, 1); }
        else { const Y = dy < 0 ? Y1 : Y0; quad(dy < 0 ? [X0, Y, zb!, X1, Y, zb!, X1, Y, za!, X0, Y, za!] : [X0, Y, za!, X1, Y, za!, X1, Y, zb!, X0, Y, zb!], n, rgb, 1); }
      }
    }
  }
  return { pos, nor, col, idx };
}

/** Which figure a picture's path is, and its pose (the page's own names). */
export function figureOf(src: string): { readonly id: string; readonly pose: string } {
  const file = src.split("/").pop() ?? "";
  const o = /^obj_([a-z]+)_([a-z]+)\.png/.exec(file);
  if (o) return { id: o[1]!, pose: o[2]! };
  const p = /^(she|he|none)-([a-z]+)\.png/.exec(file);
  if (p) return { id: "player", pose: p[2]! };
  if (/^boss-stage\d\.png/.test(file)) return { id: "boss", pose: "stance" };
  return { id: "qkuro", pose: "stance" };
}

const VERT = /* glsl */ `attribute vec3 aCol; uniform float uBreath, uWaist; varying vec3 vCol; varying vec3 vN; varying float vH;
  void main() { vCol = aCol; vH = position.y; vec3 p = position;
    if (p.y > uWaist) p.y -= uBreath; // the out-breath: everything above the waist, one of its pixels down
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const FRAG = /* glsl */ `uniform float uFlash, uDim, uGrey, uLift, uHot; uniform vec3 uAmb, uKey, uKeyDir, uRim, uRimDir; varying vec3 vCol; varying vec3 vN; varying float vH;
  void main() {
    vec3 n = normalize(vN);
    // three lights, each on its own faces: the dark all round it, the lamp's warm light, his red from the right
    float rim = max(0.0, dot(n, uRimDir)); rim *= rim; rim *= rim; // only on what faces him squarely: an edge of red, not a wash
    vec3 col = vCol * (uAmb + uKey * max(0.0, dot(n, uKeyDir)) + vec3(0.08) * max(0.0, n.y)) + uRim * rim * (0.3 + 0.7 * vCol);
    col *= uDim * (1.0 + uLift);
    col = mix(col, vCol * 1.5, uHot * step(0.3, vCol.r - max(vCol.g, vCol.b)) * step(0.45, vCol.r)); // what burns keeps burning: his eyes, the fire in his mouth
    col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * 0.6, uGrey);
    gl_FragColor = vec4(mix(col, vec3(1.0, 0.97, 0.93), uFlash), 1.0);
    #include <colorspace_fragment>
  }`;

export function createParty3d(): (root: HTMLElement, ctx: ActionContext) => Hook {
  return (root) => {
    const doc = root.ownerDocument, win = doc.defaultView!;
    let T: T3 | null = null, loading = false, failed = false;
    let canvas: HTMLCanvasElement | null = null, renderer: Obj | null = null, scene: Obj | null = null, camera: Obj | null = null;
    let bits: Obj | null = null, stage: Obj | null = null, env: Obj | null = null, place: Obj | null = null, raf = 0, last = 0;
    // the look (「这个画面是不也能拖拽看角度看3d世界」): held and dragged, the whole stage turns and tips; let go, it comes back
    // (the page's rings, numbers and hits are laid out for the eye's own place)
    const look = { yaw: 0, pitch: 0, held: false, x0: 0, y0: 0, moved: false };
    interface Model { geo: Obj; cells: Cells }
    interface Actor { id: string; kind: Kind; group: Obj; mesh: Obj; shade: Obj; mat: Obj; src: string; model: Model | null; phase: number; hurtAt: number; actAt: number; hit: boolean; wasHurt: boolean; wasActing: boolean; feet: number; x: number; h: number }
    const models = new Map<string, Model | "loading">(), actors = new Map<string, Actor>();
    interface Bit { x: number; y: number; z: number; vx: number; vy: number; rx: number; ry: number; sp: number; s: number; t: number; life: number; g: number; r: number; gr: number; b: number }
    const flying: Bit[] = [];

    const field = () => root.querySelector<HTMLElement>(".boss-page .bs-field");

    function start(): void {
      if (T || loading || failed) return;
      loading = true;
      void import("three").then((m) => {
        T = m as unknown as T3; loading = false;
        try {
          canvas = doc.createElement("canvas");
          canvas.className = "party3d";
          canvas.setAttribute("aria-hidden", "true");
          renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
          renderer.setPixelRatio(1);
          renderer.setSize(STAGE_W, STAGE_H, false);
          renderer.setClearColor(0x000000, 0);
          renderer.autoClear = false;
          scene = new T.Scene();
          // the page's own measure: x to the right, y up from the stage's bottom edge; nearer is larger z
          camera = new T.OrthographicCamera(0, STAGE_W, STAGE_H, 0, -6000, 6000);
          camera.position.z = 1000;
          // the place: the painting's wall and floor (mirrored on past its edges, so a turn does not run out of wall)
          env = new T.Scene(); place = new T.Group(); place.position.set(PIVOT_X, PIVOT_Y, 0); env.add(place);
          const pic = new T.TextureLoader().load(BACKDROP); pic.colorSpace = T.SRGBColorSpace; pic.wrapS = T.MirroredRepeatWrapping;
          const sheet = (w: number, h: number, v0: number, v1: number) => { const g = new T.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { uv.setX(i, 0.5 + (uv.getX(i) - 0.5) * (w / STAGE_W)); uv.setY(i, v0 + uv.getY(i) * (v1 - v0)); } return new T.Mesh(g, new T.MeshBasicMaterial({ map: pic, toneMapped: false })); };
          const wall = sheet(STAGE_W * 3, WALL_TOP - FLOOR_Y, HORIZON / STAGE_H, 1); wall.position.set(0, (WALL_TOP + FLOOR_Y) / 2, WALL_Z);
          const floor = sheet(STAGE_W * 3, FLOOR_NEAR - WALL_Z, 0, HORIZON / STAGE_H); floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, (FLOOR_NEAR + WALL_Z) / 2);
          place.add(wall, floor);
          stage = new T.Group(); stage.position.set(PIVOT_X, PIVOT_Y, 0); scene.add(stage);
          bits = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ toneMapped: false }), 260);
          bits.count = 0; bits.frustumCulled = false; stage.add(bits);
          after();
        } catch { failed = true; canvas = null; renderer = null; }
      }, () => { loading = false; failed = true; });
    }

    function modelFor(src: string, kind: Kind): Model | null {
      const m = models.get(src);
      if (m && m !== "loading") return m;
      if (m === "loading" || !T) return null;
      models.set(src, "loading");
      const im = new win.Image();
      im.onload = () => {
        if (!T) return;
        const c = doc.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) return;
        g.drawImage(im, 0, 0);
        const cells = readCells(c.width, c.height, g.getImageData(0, 0, c.width, c.height).data, kind.cell, kind.solid ?? 128);
        const a = solidArrays(cells, cellDepths(cells, kind), kind.plainBack === true), geo = new T.BufferGeometry(), lin = new Float32Array(a.col.length), col = new T.Color();
        for (let i = 0; i < a.col.length; i += 3) { col.setRGB(Math.min(1, a.col[i]! / 255), Math.min(1, a.col[i + 1]! / 255), Math.min(1, a.col[i + 2]! / 255), T.SRGBColorSpace); lin[i] = col.r; lin[i + 1] = col.g; lin[i + 2] = col.b; }
        geo.setAttribute("position", new T.Float32BufferAttribute(a.pos, 3)); geo.setAttribute("normal", new T.Float32BufferAttribute(a.nor, 3)); geo.setAttribute("aCol", new T.BufferAttribute(lin, 3)); geo.setIndex(a.idx);
        models.set(src, { geo, cells });
      };
      im.src = src;
      return null;
    }

    function actorFor(id: string, kindId: string): Actor {
      let a = actors.get(id);
      if (a) return a;
      const t = T!, kind = KINDS[kindId] ?? KINDS.pager!;
      const mat = new t.ShaderMaterial({ toneMapped: false, vertexShader: VERT, fragmentShader: FRAG, uniforms: {
        uBreath: { value: 0 }, uWaist: { value: 20 }, uFlash: { value: 0 }, uDim: { value: 1 }, uGrey: { value: 0 }, uLift: { value: 0 }, uHot: { value: kindId === "boss" ? 1 : 0 },
        uAmb: { value: new t.Color(0.6, 0.61, 0.69) }, uKey: { value: new t.Color(0.44, 0.37, 0.27) }, uKeyDir: { value: new t.Vector3(0.3, 0.7, 0.65).normalize() },
        uRim: { value: new t.Color(0.95, 0.16, 0.1) }, uRimDir: { value: new t.Vector3(0.93, 0.12, 0.2).normalize() } } });
      const mesh = new t.Mesh(new t.BufferGeometry(), mat); mesh.frustumCulled = false; mesh.visible = false;
      const group = new t.Group(); group.add(mesh);
      const shade = new t.Mesh(new t.CircleGeometry(0.5, 20), new t.MeshBasicMaterial({ color: 0x020003, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })); shade.frustumCulled = false; shade.rotation.x = -Math.PI / 2; // on the ground under it
      stage!.add(shade, group);
      a = { id, kind, group, mesh, shade, mat, src: "", model: null, phase: actors.size * 0.83, hurtAt: -9, actAt: -9, hit: false, wasHurt: false, wasActing: false, feet: 0, x: 0, h: 1 };
      actors.set(id, a);
      return a;
    }

    function burst(a: Actor, own: boolean, at: { x: number; y: number } | null): void {
      const R = Math.random, cells = a.model?.cells, s = cells ? a.h / cells.gh : 2.5;
      if (own && cells) { // its own pixels, off it, away from him (he is to the right) and up
        for (let n = 0, tries = 0; n < 44 && tries < 600; tries++) {
          const x = Math.floor(R() * cells.gw), y = Math.floor(R() * cells.gh * 0.85), rgb = cells.col[y * cells.gw + x]!;
          if (rgb < 0) continue;
          n++;
          flying.push({ x: a.group.position.x + (x + 0.5 - cells.gw / 2) * s, y: a.group.position.y + (cells.gh - y) * s, z: a.group.position.z + 30, vx: -(150 + R() * 520) + (R() - 0.5) * 260, vy: 260 + R() * 620, rx: R() * 6, ry: R() * 6, sp: 4 + R() * 9, s: s * (1 + Math.floor(R() * 2)), t: 0, life: 0.8 + R() * 0.5, g: FLOOR_Y + R() * 6, r: (rgb >> 16) & 255, gr: (rgb >> 8) & 255, b: rgb & 255 });
        }
      } else if (at) { // a blow landed on him: his own pixels where it landed (pieces of his hide when he is not in sight), knocked back toward them
        const HIDE = [[22, 9, 13], [42, 12, 20], [74, 16, 24], [255, 90, 38], [255, 176, 96], [12, 6, 8]] as const;
        const lx = at.x - PIVOT_X, ly = a.group.position.y + (at.y - a.feet), lz = a.group.position.z + (a.id === "boss" ? 80 : 40);
        for (let n = 0; n < 40; n++) {
          let c: readonly [number, number, number] = HIDE[Math.floor(R() * HIDE.length)]!;
          if (a.id === "boss" && cells) { const cx = Math.floor(cells.gw * (0.2 + R() * 0.25)), cy = Math.floor(cells.gh * (0.3 + R() * 0.3)), rgb = cells.col[cy * cells.gw + cx]!; if (rgb >= 0) c = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]; }
          flying.push({ x: lx + (R() - 0.5) * 70, y: ly + (R() - 0.5) * 90, z: lz, vx: -(120 + R() * 620) + (R() - 0.5) * 300, vy: 200 + R() * 760, rx: R() * 6, ry: R() * 6, sp: 5 + R() * 10, s: (a.id === "boss" ? s : PX) * (1 + Math.floor(R() * 2)), t: 0, life: 0.8 + R() * 0.6, g: FLOOR_Y + R() * 6, r: c[0], gr: c[1], b: c[2] });
        }
      }
    }

    function frame(ms: number): void {
      raf = win.requestAnimationFrame(frame);
      const f = field();
      if (!T || !renderer || !scene || !camera || !canvas || !f || doc.hidden) { last = 0; return; }
      const now = ms / 1000, dt = last ? Math.min(0.05, now - last) : 0.016; last = now;
      const fr = f.getBoundingClientRect(), k = fr.width / STAGE_W || 1, world = !!f.closest(".boss-page.world");
      const lampX = 800; // the lit room in the picture hangs over the middle of the stage
      const seen = new Set<string>();
      for (const el of f.querySelectorAll<HTMLElement>(".bs-member[data-id], .bs-boss")) {
        const img = el.querySelector<HTMLImageElement>("img.bs-sprite, img.bs-boss-img");
        if (!img) continue;
        const src = img.getAttribute("src") ?? "", fig = figureOf(src), id = el.dataset.id ?? "boss", a = actorFor(id, fig.id);
        seen.add(id);
        if (a.src !== src) { a.src = src; }
        const m = modelFor(src, a.kind);
        if (m && a.model !== m) { a.model = m; a.mesh.geometry = m.geo; a.mesh.visible = true; }
        if (!a.model) { a.group.visible = false; a.shade.visible = false; continue; }
        // where the page has it: the member's own foot line, the picture's middle (its lunges and jolts carry it), on
        // the canvas's own pixels (a place between two of them is a figure that shimmers)
        const mr = el.getBoundingClientRect(), ir = img.getBoundingClientRect(), boss = fig.id === "boss";
        const snap = (v: number) => Math.round(v / PX) * PX;
        // (the member carries no motion of its own, so its box against its laid-out width is the scale its place gives it)
        a.h = boss ? BOSS_H : (img.offsetHeight || 160) * (el.offsetWidth ? mr.width / k / el.offsetWidth : 1);
        a.x = snap((ir.left + ir.width / 2 - fr.left) / k); a.feet = snap(STAGE_H - ((boss ? ir.bottom : mr.bottom) - fr.top) / k);
        const cellPx = a.h / a.model.cells.gh, down = el.classList.contains("down"), hurt = el.classList.contains("hurt"), acting = el.classList.contains("acting"), cs = win.getComputedStyle(el), gone = Number(cs.opacity) < 0.05 || cs.visibility === "hidden";
        if (hurt && !a.wasHurt) { a.hurtAt = now; burst(a, true, null); }
        if (acting && !a.wasActing) { a.actAt = now; a.hit = false; }
        a.wasHurt = hurt; a.wasActing = acting;
        const u = a.mat.uniforms, breath = (now + a.phase * 2.65) % 2.65;
        u.uBreath!.value = !down && !boss && breath > 1.1 && breath < 2.3 ? 1 : 0; u.uWaist!.value = a.model.cells.gh * a.kind.waist;
        const sinceHurt = now - a.hurtAt, sinceAct = now - a.actAt, eff = f.dataset.eff ?? "";
        u.uFlash!.value = Math.max(0, 1 - sinceHurt / 0.2); u.uGrey!.value = down ? 1 : 0; u.uLift!.value = el.classList.contains("ready") ? 0.22 : 0;
        // the nearer the eye the brighter: the ones at the back stand in the dark of the place
        u.uDim!.value = boss ? 1 : 0.74 + 0.26 * Math.min(1, Math.max(0, (260 - a.feet) / 120));
        (u.uKeyDir!.value as Obj).set((lampX - a.x) / 500, 0.75, 0.6).normalize();
        if (boss) { (u.uAmb!.value as Obj).setRGB(0.92, 0.9, 0.94); (u.uKey!.value as Obj).setRGB(0.14, 0.12, 0.1); (u.uRim!.value as Obj).setRGB(0.5, 0.34, 0.2); (u.uRimDir!.value as Obj).set(-1, 0.1, -0.1).normalize(); } // he keeps his own colours: only his edge toward the lamp takes its light
        else if (world) { (u.uKey!.value as Obj).setRGB(0.36, 0.3, 0.32); (u.uRim!.value as Obj).setRGB(1.0, 0.2, 0.12); (u.uRimDir!.value as Obj).set(0.35, -0.75, 0.45).normalize(); } // out there the red comes up from the ground
        else { (u.uKey!.value as Obj).setRGB(0.44, 0.37, 0.27); (u.uRim!.value as Obj).setRGB(0.95, 0.16, 0.1); (u.uRimDir!.value as Obj).set(0.93, 0.12, 0.2).normalize(); }
        // turned a little toward the other side so its thickness shows; still, until it acts
        let yaw = boss ? -0.34 : 0.3, roll = 0, lift = 0;
        if (!boss && acting && sinceAct < 0.9) {
          const q = sinceAct / 0.9;
          if (eff === "hit" || eff === "stun") { yaw += a.id === "player" ? -0.9 * Math.sin(Math.min(1, q / 0.55) * Math.PI) : Math.PI * 2 * Math.min(1, q / 0.5) ** 2 * (3 - 2 * Math.min(1, q / 0.5)); // the player's body swung through; an old thing goes in spinning, once round
            if (q > 0.36 && !a.hit) { a.hit = true; const him = actors.get("boss"); burst(him && him.group.visible ? him : a, false, him && him.group.visible ? { x: him.x - him.h * 0.22, y: him.feet + him.h * 0.52 } : { x: a.x + 190, y: a.feet + a.h * 0.7 }); } }
          else yaw += 0.5 * Math.sin(q * Math.PI * 2);
          lift = 14 * Math.sin(Math.min(1, q * 2) * Math.PI);
        }
        if (sinceHurt < 0.5) { const q = 1 - sinceHurt / 0.5; roll = (boss ? -0.06 : 0.3) * q * q; yaw -= (boss ? -0.25 : 0.5) * q; }
        if (down && !boss) roll = 1.35;
        a.group.visible = !gone; a.shade.visible = !gone && !boss;
        // in the stage's own measure: further up the frame is further back; the stage is tipped toward the eye, so its
        // height on the ground is worked back from where its feet must show
        // everyone stands on the floor: a place further up the frame is that much further back on it. He hangs over it.
        const F = a.feet - PIVOT_Y, z = boss ? BOSS_Z : (FLOOR_Y * Math.cos(TIP) - F) / Math.sin(TIP), y = boss ? (F + z * Math.sin(TIP)) / Math.cos(TIP) : FLOOR_Y;
        a.group.position.set(a.x - PIVOT_X - (down && !boss ? a.h * 0.3 : 0), y + lift + (down && !boss ? cellPx * a.kind.half : 0), z);
        a.group.rotation.set(0, yaw, roll, "ZXY");
        a.group.scale.setScalar(cellPx);
        a.shade.position.set(a.x - PIVOT_X, FLOOR_Y + 1, z); a.shade.scale.set(a.h * 0.66, a.h * 1.5, 1);
      }
      for (const [id, a] of actors) if (!seen.has(id)) { a.group.visible = false; a.shade.visible = false; }
      // the look: follows the hand, comes back when let go
      if (!look.held) { look.yaw *= Math.exp(-dt * 5); look.pitch *= Math.exp(-dt * 5); if (Math.abs(look.yaw) < 0.002) look.yaw = 0; if (Math.abs(look.pitch) < 0.002) look.pitch = 0; }
      stage!.rotation.set(TIP + look.pitch, look.yaw, 0, "XYZ");
      // the blocks: thrown, falling, one bounce, gone
      let n = 0;
      const dummy = new T.Object3D(), col = new T.Color();
      for (let i = flying.length - 1; i >= 0; i--) {
        const b = flying[i]!; b.t += dt;
        if (b.t > b.life) { flying.splice(i, 1); continue; }
        b.vy -= 2300 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < b.g && b.vy < 0) { b.y = b.g; b.vy *= -0.36; b.vx *= 0.55; b.sp *= 0.5; }
        if (n >= 260) continue;
        dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(b.rx + b.t * b.sp, b.ry + b.t * b.sp * 0.7, 0); dummy.scale.setScalar(b.s * Math.min(1, (b.life - b.t) / 0.25)); dummy.updateMatrix();
        bits!.setMatrixAt(n, dummy.matrix);
        const w = Math.max(0, 0.7 - b.t * 6);
        bits!.setColorAt(n, col.setRGB((b.r + (255 - b.r) * w) / 255, (b.gr + (255 - b.gr) * w) / 255, (b.b + (255 - b.b) * w) / 255, T.SRGBColorSpace)); n++;
      }
      bits!.count = n; bits!.instanceMatrix.needsUpdate = true; if (bits!.instanceColor) bits!.instanceColor.needsUpdate = true;
      place!.rotation.copy(stage!.rotation);
      renderer.clear();
      // the place is drawn while the fight is in its own room: out in the world (the second phase) and after the fall the page's own pictures are behind
      if (!world && !f.closest(".boss-page.after")) renderer.render(env, camera);
      renderer.clearDepth(); // the figures stand in front of the place's sheets wherever those are
      renderer.render(scene, camera);
    }

    function after(): void {
      const f = field();
      if (!f) { if (raf) { win.cancelAnimationFrame(raf); raf = 0; } canvas?.remove(); return; }
      if (!T) { start(); return; }
      if (!canvas || failed) return;
      if (canvas.parentElement !== f) f.appendChild(canvas);
      f.closest(".boss-page")?.classList.add("p3d"); // the page's own pictures stay where they are, unseen: this layer draws them
      if (!raf) { last = 0; raf = win.requestAnimationFrame(frame); }
    }

    // The look. A press on the field's own ground (not on a button, a command, the box) and a drag: the stage turns with
    // the hand. A drag is not a click: the click that ends one is swallowed.
    const onDown = (e: PointerEvent) => { const t = e.target as HTMLElement | null; if (!canvas || !t?.closest(".bs-field") || t.closest("[data-action], button, .bs-menu, .bs-box")) return; look.held = true; look.moved = false; look.x0 = e.clientX - look.yaw / 0.0035; look.y0 = e.clientY - look.pitch / 0.0025; };
    const onMove = (e: PointerEvent) => { if (!look.held) return; const dx = e.clientX - look.x0, dy = e.clientY - look.y0; if (Math.abs(dx) + Math.abs(dy) > 6) look.moved = true; look.yaw = Math.max(-0.8, Math.min(0.8, dx * 0.0035)); look.pitch = Math.max(-0.14, Math.min(0.5, dy * 0.0025)); };
    const onUp = () => { look.held = false; };
    const onClick = (e: MouseEvent) => { if (look.moved) { look.moved = false; e.stopPropagation(); e.preventDefault(); } };
    root.addEventListener("pointerdown", onDown); win.addEventListener("pointermove", onMove); win.addEventListener("pointerup", onUp); win.addEventListener("pointercancel", onUp); root.addEventListener("click", onClick, true);

    return {
      after,
      destroy() {
        root.removeEventListener("pointerdown", onDown); win.removeEventListener("pointermove", onMove); win.removeEventListener("pointerup", onUp); win.removeEventListener("pointercancel", onUp); root.removeEventListener("click", onClick, true);
        if (raf) win.cancelAnimationFrame(raf);
        raf = 0;
        canvas?.remove();
        for (const m of models.values()) if (m !== "loading") m.geo.dispose();
        for (const a of actors.values()) a.mat.dispose();
        renderer?.dispose();
        canvas = null; renderer = null;
      },
    };
  };
}
