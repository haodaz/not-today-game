// The flesh tentacles of the code-built room (room.js, "tentacles"), over a flat board: day 17's
// klotski at the door moment (author 2026-11-27: 「触手不对，用 3d 做出来的那种」「血肉触手」).
// A transparent page put over the tray in an <iframe>. The hash carries the job as JSON:
//   { at: epoch ms the door opened, cols, rows, m: [left, top, right, bottom] margins in cells,
//     s: [{ p: [[x, y], …] in cells (y down), r: radius in cells, d: delay ms }] }
// Each tentacle is the room's: a tube recomputed every frame from its centre line (how far it has
// grown, the taper to the tip, a slow swallow down its length, a sway that grows toward the tip), a dark
// wine hide above, pale raw flesh on the belly, suckers in two staggered rows.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let job = {};
try { job = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch { job = {}; }
const COLS = job.cols ?? 4, ROWS = job.rows ?? 5, MAR = job.m ?? [1, 1, 1, 2];
const AT = job.at ?? Date.now(), STRANDS = job.s ?? [];
const GROW_MS = job.grow ?? 1500;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
// the board lies in the x-y plane (x right, y up = -row); the camera looks straight down at it
const cam = new THREE.OrthographicCamera(-MAR[0], COLS + MAR[2], MAR[1], -(ROWS + MAR[3]), 0.1, 50);
cam.position.set(0, 0, 10);
scene.add(new THREE.HemisphereLight(0xffe9dc, 0x2a0508, 0.7));
const sun = new THREE.DirectionalLight(0xfff0e2, 2.4);
sun.position.set(-3, 5, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -COLS - 2, right: COLS + 2, top: ROWS + 3, bottom: -ROWS - 3, near: 0.1, far: 40 });
sun.shadow.radius = 5; sun.shadow.bias = -0.002;
sun.target.position.set(COLS / 2, -ROWS / 2, 0);
scene.add(sun, sun.target);
const rim = new THREE.PointLight(0xff3a2a, 6, 6); // the door's red, from below the tray
rim.position.set(COLS / 2, -(ROWS + 0.6), 1.2);
scene.add(rim);
// what they lie on: nothing drawn but their shadow
const ground = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 6, ROWS + 8), new THREE.ShadowMaterial({ opacity: 0.5 }));
ground.position.set(COLS / 2, -ROWS / 2, 0);
ground.receiveShadow = true;
scene.add(ground);

const tentMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.35, side: THREE.DoubleSide });
const SUCK_MAX = 1400;
const SUCK = new THREE.InstancedMesh(
  new THREE.LatheGeometry([[0, 0.1], [0.3, 0.02], [0.62, 0.16], [0.86, 0.36], [1.0, 0.34], [1.06, 0.12], [0.94, -0.06]].map((p) => new THREE.Vector2(p[0], p[1])), 14),
  new THREE.MeshStandardMaterial({ color: 0xc98f86, roughness: 0.3 }), SUCK_MAX);
SUCK.frustumCulled = false; SUCK.count = 0; SUCK.receiveShadow = true;
scene.add(SUCK);
const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sp = new THREE.Vector3(), _ss = new THREE.Vector3(), _sd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const h2 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const tentacles = [];

function tentacle(points, r, delay, sway) {
  const N = 150, RS = 16, ph = tentacles.length * 1.93;
  // lifted off the board by its own thickness, rising and falling a little along its length so they cross over each other
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y], j) => new THREE.Vector3(x, -y, r * (0.95 + 0.9 * (0.5 + 0.5 * Math.sin(j * 1.9 + ph))) + tentacles.length * 0.012)));
  const centres = curve.getSpacedPoints(N), fr = curve.computeFrenetFrames(N, false);
  const count = (N + 1) * (RS + 1);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= RS; j++) {
    const ang = (j / RS) * Math.PI * 2, sucker = Math.pow(0.5 + 0.5 * Math.sin(i * 1.35), 6);
    const dz = Math.cos(ang) * fr.normals[i].z + Math.sin(ang) * fr.binormals[i].z; // +1: this skin faces up, at the eye
    const o = (i * (RS + 1) + j) * 3, mot = h2(i * 0.37, j * 0.9 + points.length), spot = h2(Math.floor(i / 3) * 1.7, Math.floor(j / 2) * 2.3) > 0.82 ? 1 : 0;
    // back: a dark, mottled hide, wine at the edges; belly: pale raw flesh, where the suckers sit
    const top = [0.2 + 0.08 * mot + 0.1 * spot, 0.025 + 0.015 * mot + 0.03 * spot, 0.055 + 0.03 * mot + 0.02 * spot], belly = [0.56 + 0.08 * mot, 0.22 + 0.05 * mot, 0.21 + 0.04 * mot];
    const kk = Math.pow(Math.min(1, Math.max(0, (0.62 - dz) / 1.25)), 1.25) * (0.85 + 0.15 * sucker); // the back is seen from above; the raw belly comes up the flanks
    col[o] = top[0] + (belly[0] - top[0]) * kk; col[o + 1] = top[1] + (belly[1] - top[1]) * kk; col[o + 2] = top[2] + (belly[2] - top[2]) * kk;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, tentMat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh);
  tentacles.push({ mesh, geo, centres, fr, r, delay, sway, ph, N, RS });
}
for (const s of STRANDS) if (Array.isArray(s.p) && s.p.length >= 2) tentacle(s.p, s.r ?? 0.12, s.d ?? 0, s.sway ?? 0.1);

// a surge: slow for a moment at the sill, then it comes all at once
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (2.2 - 1.2 * t));
function update(now) {
  const s = now / 1000;
  let sc = 0;
  for (const t of tentacles) {
    const grow = still ? 1 : ease((Date.now() - AT - t.delay) / GROW_MS);
    t.mesh.visible = grow > 0.01;
    if (!t.mesh.visible) continue;
    const P = t.geo.attributes.position.array, Nn = t.geo.attributes.normal.array, { N, RS } = t;
    for (let i = 0; i <= N; i++) {
      const tt = i / N, live = tt <= grow, k = live ? tt : grow, ci = Math.min(N, Math.round(k * N));
      const rad = live ? t.r * Math.pow(Math.max(0, 1 - k / (grow + 0.04)), 0.5) * (1 + 0.1 * Math.sin(tt * 46 - s * 2.2 + t.ph) + 0.03 * Math.sin(i * 2.1)) : 0; // a slow swallow, and rings of skin
      const sw = still ? 0 : k * k * t.sway * grow, c = t.centres[ci], n = t.fr.normals[ci], b = t.fr.binormals[ci];
      const cx = c.x + Math.sin(s * 0.9 + k * 5 + t.ph) * sw, cy = c.y + Math.cos(s * 0.7 + k * 4 + t.ph * 1.3) * sw, cz = c.z + Math.sin(s * 0.8 + k * 6 + t.ph * 0.7) * sw * 0.3;
      if (i % 3 === 1 && live && rad > 0.012 && sc < SUCK_MAX) { // a sucker where the flank turns under, alternating sides, seen from above
        const flat = Math.abs(n.z) < Math.abs(b.z) ? n : b, up = flat === n ? b : n, us = up.z < 0 ? -1 : 1, fs = (i / 3) % 2 < 1 ? 1 : -1;
        _sd.set(flat.x * fs * 0.86 + up.x * us * 0.3, flat.y * fs * 0.86 + up.y * us * 0.3, flat.z * fs * 0.86 + up.z * us * 0.3).normalize();
        _sp.set(cx + _sd.x * rad * 0.9, cy + _sd.y * rad * 0.9, cz + _sd.z * rad * 0.9);
        _sq.setFromUnitVectors(UP, _sd);
        const q = rad * 0.3; _ss.set(q, q, q);
        SUCK.setMatrixAt(sc++, _sm.compose(_sp, _sq, _ss));
      }
      for (let j = 0; j <= RS; j++) {
        const a = (j / RS) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), o = (i * (RS + 1) + j) * 3;
        const nx = ca * n.x + sa * b.x, ny = ca * n.y + sa * b.y, nz = ca * n.z + sa * b.z;
        P[o] = cx + nx * rad; P[o + 1] = cy + ny * rad; P[o + 2] = cz + nz * rad;
        Nn[o] = nx; Nn[o + 1] = ny; Nn[o + 2] = nz;
      }
    }
    t.geo.attributes.position.needsUpdate = true;
    t.geo.attributes.normal.needsUpdate = true;
  }
  SUCK.count = sc; SUCK.instanceMatrix.needsUpdate = true;
}

function size() {
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener("resize", size);
size();
function frame(now) {
  update(now);
  renderer.render(scene, cam);
  if (!still) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
