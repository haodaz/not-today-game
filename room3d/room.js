// Room prototype (design only, not part of the game build): the rented room built from code with
// three.js. No image or model files; every texture is painted on a canvas when the page opens, and
// the collapse is computed per pixel from the wall's own position, so a percentage is a threshold
// moving through a noise field, not a picture swapped in.
// World: x = east, y = up, z = south. North wall (desk) at z = -2, west wall (big window) at x = -1.8.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
// the pictures on the chick are content, never drawn in code: the same file the device in the game reads
import chickFrames from "../content/frames/chick.json";
const T0 = performance.now();

const ROOM = { w: 3.7, d: 4.2, h: 2.7 }; // width read off the photo (window wall, desk, a gap with the carton, the bed); deeper than the first build so there is floor to stand on
const X0 = -ROOM.w / 2, X1 = ROOM.w / 2, Z0 = -ROOM.d / 2, Z1 = ROOM.d / 2;
const DESK = { x: X0 + 0.33 + 0.81, z: Z0 + 0.42, w: 1.62, d: 0.74, h: 0.75 }; // a hand's width off the window wall, as in the photo, so the window and the pipe come into the picture // measured off the photo it replaces (room.jpg): the pair of screens is about two thirds of the desk's width
const EYE = new THREE.Vector3(0.15, 1.16, 1.2);
const DESK_EYE = new THREE.Vector3(DESK.x + 0.02, 1.56, DESK.z + 0.62);
const FACES = [
  { name: "桌墙", yaw: 0, photo: "/room/shots/room.jpg", eye: [-0.1, 1.25, 0.8], pitch: -0.07, fov: 52 },
  { name: "床墙", yaw: -Math.PI / 2, photo: "/room/shots/bed.jpg", eye: [-0.95, 1.22, 1.15], pitch: -0.17, yawOff: 0.5 },
  { name: "门墙", yaw: -Math.PI, photo: "/room/door_wall.png", eye: [0.3, 1.16, -0.8], pitch: -0.04, yawOff: 0.1 },
  { name: "窗墙", yaw: -Math.PI * 1.5, photo: "/room/shots/window.jpg", eye: [1.2, 1.2, 0.0], pitch: -0.1 },
];
for (const f of FACES) f.eye = new THREE.Vector3(...f.eye);
const MEAL_EYE = new THREE.Vector3(X0 + 0.98, 1.02, 0.95);
const DESK_PHOTO = "/room/shots/desk_top.jpg";

// ---------- helpers: seeded noise, canvases ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function ss(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}
function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, r, alpha, seed) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const v = R() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${R() * alpha})`;
    g.beginPath();
    g.arc(R() * w, R() * h, R() * r + 0.3, 0, 7);
    g.fill();
  }
}
function blotch(g, x, y, r, rgb, a) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, `rgba(${rgb},${a})`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------- painted textures ----------
function wallTexture() {
  const [c, g] = canvas(1024, 1024), W = 1024, R = rng(7);
  g.fillStyle = "#d9d8d3";
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 60; i++) blotch(g, R() * W, R() * W, 80 + R() * 220, R() < 0.5 ? "255,255,255" : "186,184,176", 0.06);
  speckle(g, W, W, 16000, 1.3, 0.07, 11); // roller texture
  for (let i = 0; i < 16; i++) { // scuffs every rented wall has
    g.strokeStyle = `rgba(90,85,80,${0.04 + R() * 0.05})`;
    g.lineWidth = 1 + R() * 2;
    g.beginPath();
    const x = R() * W, y = R() * W;
    g.moveTo(x, y);
    g.lineTo(x + (R() - 0.5) * 60, y + (R() - 0.5) * 14);
    g.stroke();
  }
  return tex(c);
}
function woodTexture(base, dark, seed, planks = 0) {
  const [c, g] = canvas(1024, 1024), W = 1024, R = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 620; i++) {
    const y = R() * W;
    g.strokeStyle = R() < 0.6 ? `rgba(${dark},${0.04 + R() * 0.1})` : `rgba(255,236,200,${0.03 + R() * 0.06})`;
    g.lineWidth = 0.6 + R() * 2.4;
    g.beginPath();
    g.moveTo(0, y);
    const amp = R() * 5, f = 0.004 + R() * 0.01, ph = R() * 6;
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = R() * W, y = R() * W;
    for (let r = 16; r > 2; r -= 3) {
      g.strokeStyle = `rgba(${dark},0.14)`;
      g.beginPath(); g.ellipse(x, y, r * 2.2, r, 0, 0, 7); g.stroke();
    }
  }
  if (planks) {
    const ph = W / planks;
    for (let p = 0; p < planks; p++) {
      // each board is its own length and its own tone; seams are a soft dark line with a lit edge, not a ruled grid
      let x0 = -R() * W * 0.4;
      while (x0 < W) {
        const len = W * (0.28 + R() * 0.34);
        g.fillStyle = `rgba(${R() < 0.5 ? "30,16,4" : "255,236,200"},${0.02 + R() * 0.11})`;
        g.fillRect(x0, p * ph, len, ph);
        g.fillStyle = "rgba(40,24,10,0.34)"; g.fillRect(x0, p * ph, 1.5, ph);
        g.fillStyle = "rgba(255,240,215,0.12)"; g.fillRect(x0 + 1.5, p * ph, 1, ph);
        x0 += len;
      }
      g.fillStyle = "rgba(40,24,10,0.36)"; g.fillRect(0, p * ph, W, 1.5);
      g.fillStyle = "rgba(255,240,215,0.1)"; g.fillRect(0, p * ph + 1.5, W, 1);
    }
  }
  return tex(c);
}
function fabricTexture(base, seed) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const R = rng(seed);
  for (let i = 0; i < 512; i += 2) {
    g.fillStyle = `rgba(0,0,0,${R() * 0.09})`;
    g.fillRect(i, 0, 1, 512);
    g.fillStyle = `rgba(255,255,255,${R() * 0.06})`;
    g.fillRect(0, i, 512, 1);
  }
  speckle(g, 512, 512, 5000, 1.5, 0.06, seed + 1);
  return tex(c);
}
function cardboardTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#b08a5c";
  g.fillRect(0, 0, 512, 512);
  const R = rng(5);
  for (let x = 0; x < 512; x += 4) {
    g.fillStyle = `rgba(60,36,10,${0.03 + R() * 0.05})`;
    g.fillRect(x, 0, 2, 512);
  }
  speckle(g, 512, 512, 2500, 2, 0.06, 6);
  return tex(c);
}
function facadeTextures(seed) {
  const W = 1024, H = 1024, cols = 9, rows = 7;
  const [c, g] = canvas(W, H), [e, eg] = canvas(W, H), R = rng(seed);
  g.fillStyle = "#b9b1a3";
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) blotch(g, R() * W, R() * H, 40 + R() * 160, "88,82,72", 0.12);
  for (let i = 0; i < 60; i++) {
    const x = R() * W, y = R() * H;
    g.fillStyle = `rgba(60,56,50,${0.05 + R() * 0.1})`;
    g.fillRect(x, y, 2 + R() * 5, 60 + R() * 220);
  }
  eg.fillStyle = "#000";
  eg.fillRect(0, 0, W, H);
  const cw = W / cols, rh = H / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = k * cw + cw * 0.22, y = r * rh + rh * 0.22, w = cw * 0.56, h = rh * 0.5;
    g.fillStyle = "#3d4650";
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(210,220,230,0.25)";
    g.fillRect(x, y, w, h * 0.35);
    g.strokeStyle = "#e7e6e0";
    g.lineWidth = 4;
    g.strokeRect(x, y, w, h);
    g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
    if (R() < 0.3) { g.fillStyle = "#d8d6cf"; g.fillRect(x + w * 0.15, y + h + 6, w * 0.5, rh * 0.14); }
    const lit = R();
    if (lit < 0.42) {
      eg.fillStyle = lit < 0.3 ? "#ffc36b" : lit < 0.38 ? "#dfe9ff" : "#ff8f5a";
      eg.globalAlpha = 0.55 + R() * 0.45;
      eg.fillRect(x + 3, y + 3, w - 6, h - 6);
      eg.globalAlpha = 1;
    }
  }
  return [tex(c, false), tex(e, false)];
}
/** A face painted once: an LCD, a socket plate, a label. */
function face(w, h, bg, draw) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  draw(g, w, h);
  const t = tex(c, false);
  return t;
}

// ---------- the shader patch: collapse and unreality are computed, not painted ----------
const U = { uCollapse: { value: 0 }, uWhite: { value: 0 }, uPixel: { value: 0 }, uTime: { value: 0 } };
const NOISE = /* glsl */ `
uniform float uCollapse;
uniform float uWhite;
uniform float uPixel;
uniform float uTime;
varying vec3 vWPos;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s / 0.96875; }
// Flesh is one field through the whole room, so a patch on the wall carries on across the floor and up a table leg.
// Returns the colour in rgb and the mask in a; writes its height (metres) for the bump.
vec4 flesh(vec3 p, float c, out float height) {
  float a = fbm(p * 0.9 + 31.0), b = fbm(p * 3.1 + 17.0);
  float T = 1.36 - c * 1.033 + c * c * 0.433, on = step(0.001, c); // it never takes the whole wall: at the end a good third is still paint
  float field = a * 0.75 + b * 0.4 + 0.25;
  float m = smoothstep(T, T + 0.035, field) * on;            // where it is
  float dome = smoothstep(T, T + 0.16, field) * on;           // how far in from its edge: it swells toward the middle
  float halo = smoothstep(T - 0.11, T, field) * (1.0 - m) * on; // the paint around it has already turned
  float strand = 1.0 - abs(2.0 * fbm(vec3(p.x * 2.2, p.y * 7.0, p.z * 2.2) + b * 1.5 + 60.0) - 1.0); // muscle runs in one direction
  float lump = vn(p * 13.0 + 40.0); lump *= lump;            // lobes
  float pore = smoothstep(0.78, 0.84, vn(p * 27.0 + 9.0)) * dome; // small openings, only well inside
  float pulse = 0.5 + 0.5 * sin(uTime * 1.3 + a * 12.0);
  vec3 col = mix(vec3(0.17, 0.012, 0.03), vec3(0.6, 0.12, 0.11), strand * strand);
  col = mix(col, vec3(0.34, 0.03, 0.16), dome * 0.55 * (1.0 - strand));           // darker and bluer in the deep part
  float rim = (1.0 - dome) * (1.0 - dome); col = mix(col, vec3(0.8, 0.34, 0.3), rim * rim * 0.42);      // raw and pale where it is new
  col = mix(col, vec3(0.8, 0.68, 0.46), smoothstep(0.7, 0.78, fbm(p * 9.0 + 5.0)) * 0.3); // fat
  float cord = 1.0 - smoothstep(0.0, 0.012, abs(fbm(p * 3.3 + vec3(0.0, a * 2.0, 0.0) + 80.0) - 0.5));
  col = mix(col, vec3(0.1, 0.02, 0.12), cord * 0.4);
  col = mix(col, vec3(0.04, 0.0, 0.01), pore * 0.9);
  col *= 0.88 + 0.14 * pulse;
  col = mix(vec3(0.1, 0.02, 0.025), col, smoothstep(0.0, 0.5, m)); // a dark scab where it meets the paint
  vec3 bruise = mix(vec3(0.44, 0.38, 0.22), vec3(0.3, 0.1, 0.2), smoothstep(0.35, 1.0, halo));
  col = mix(bruise, col, m);
  height = m * (0.006 + 0.03 * dome + 0.022 * strand * dome + 0.012 * lump + 0.006 * pulse + 0.008 * cord) - pore * 0.02;
  return vec4(col, max(m, halo * 0.5));
}
`;
// kind 1: a painted wall. Damp comes down from the ceiling, rust blooms out of it and runs, veins surface, then flesh.
const ROT_WALL = /* glsl */ `
float rotWet = 0.0, rotH = 0.0;
{
  vec3 p = vWPos; float c = uCollapse;
  float n1 = fbm(p * 1.1 + 3.1), n2 = fbm(p * 3.6 + 11.0), n3 = fbm(p * 15.0 + 1.7);
  { // a lived-in white wall is never one white: uneven rolling, greyer toward the ceiling and the corners, scuffed above the skirting
    float tone = 0.9 + 0.13 * fbm(p * 0.65 + 40.0) + 0.03 * (n3 - 0.5);
    float up = smoothstep(1.5, 2.7, p.y), low = 1.0 - smoothstep(0.085, 0.42, p.y);
    float along = max(${(ROOM.w / 2).toFixed(2)} - abs(p.x), ${(ROOM.d / 2).toFixed(2)} - abs(p.z));
    float corner = 1.0 - smoothstep(0.0, 0.7, along);
    float roller = 0.5 + 0.5 * sin(p.x * 23.0 + p.z * 23.0 + n1 * 3.0);
    diffuseColor.rgb *= tone * (1.0 - 0.11 * up - 0.07 * low * (0.6 + 0.8 * n2) - 0.1 * corner) * (0.985 + 0.015 * roller) * vec3(0.985, 0.98, 0.965);
  }
  float top = smoothstep(0.0, 2.7, p.y);
  float dT = 1.22 - c * 0.95 - top * 0.3;
  float damp = smoothstep(dT, dT + 0.16, n1 + n3 * 0.07) * step(0.001, c);
  float rT = 1.3 - c * 0.72;
  float rust = smoothstep(rT, rT + 0.07, n2 + n1 * 0.45) * step(0.001, c);
  float run = smoothstep(rT + 0.02, rT + 0.16, fbm(vec3(p.x * 11.0, p.y * 0.7, p.z * 11.0) + 5.0) + n1 * 0.45) * c;
  vec3 w = p * 1.9 + vec3(fbm(p * 2.3), fbm(p * 2.3 + 9.0), fbm(p * 2.3 + 4.0)) * 1.4;
  float ridge = abs(fbm(w + 20.0) - 0.5);
  float vein = (1.0 - smoothstep(0.0, 0.006 + 0.008 * c, ridge)) * smoothstep(0.3, 0.75, c) * smoothstep(0.42, 0.6, n1 + top * 0.12);
  float peel = smoothstep(0.6, 0.63, n3) * damp * smoothstep(0.2, 0.6, c);
  vec3 col = diffuseColor.rgb;
  col = mix(col, col * vec3(0.5, 0.46, 0.37), damp * 0.9);
  col = mix(col, vec3(0.5, 0.48, 0.44), peel * 0.55);
  col = mix(col, vec3(0.2, 0.07, 0.04), run * 0.55);
  col = mix(col, vec3(0.36, 0.13, 0.05) * (0.55 + n3), rust * 0.92);
  col = mix(col, vec3(0.2, 0.015, 0.035), vein * 0.9);
  float fh; vec4 f = flesh(p, c, fh);
  col = mix(col, f.rgb, f.a);
  diffuseColor.rgb = col;
  rotWet = max(damp * 0.6 + vein * 0.4, f.a * 0.92);
  rotH = fh + vein * 0.004;
}`;
// kind 2: the floor. Water stands in it, and the flesh crosses it.
const ROT_FLOOR = /* glsl */ `
float rotWet = 0.0, rotH = 0.0;
{
  vec3 p = vWPos; float c = uCollapse;
  float n = fbm(vec3(p.x * 1.4, 0.0, p.z * 1.4) + 2.0);
  float T = 1.1 - c * 0.75;
  float pool = smoothstep(T, T + 0.05, n) * step(0.001, c);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.28, 0.2, 0.17), pool * 0.9 + c * 0.25);
  float fh; vec4 f = flesh(p, max(0.0, c - 0.12), fh);
  diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a);
  rotWet = max(pool, f.a * 0.92);
  rotH = fh;
}`;
// kind 0: everything else. The flesh reaches the furniture later than the walls.
const ROT_THING = /* glsl */ `
float rotWet = 0.0, rotH = 0.0;
{
  float fh; vec4 f = flesh(vWPos, max(0.0, uCollapse - 0.3), fh);
  diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a);
  rotWet = f.a * 0.92; rotH = fh;
}`;
const ROT = [ROT_THING, ROT_WALL, ROT_FLOOR, "float rotWet = 0.0, rotH = 0.0;"];
// Broken pixels: space itself is cut into cubes. Some cubes are simply missing, some keep fewer colours,
// some are stuck on one channel. A cube belongs to a place, not a surface, so a break runs through wall, desk and cup alike.
const PIXEL = /* glsl */ `
vec3 pixGlow = vec3(0.0);
bool pixGone = false;
if (uPixel > 0.0) {
  vec3 q = vWPos + vec3(0.0137, 0.0071, 0.0113);
  float pick = h31(floor(q / 0.12) + 3.0);
  float size = pick < 0.15 ? 0.04 : pick < 0.55 ? 0.02 : 0.01; // mostly 1–2 cm cubes, a few 4 cm
  vec3 cell = floor(q / size);
  // every cube has its own number; it breaks when the amount passes it. Nowhere is first: only the total grows.
  if (h31(cell + 5.0) < uPixel * uPixel * 0.92) {
    float k = h31(cell + 9.0), tick = floor(uTime * 1.5);
    float flick = step(0.95, h31(cell + tick * 0.37));
    if (k < 0.24) pixGone = true; // dropped at the very end: a discard here would poison the derivatives the bump needs
    else if (k < 0.66) diffuseColor.rgb = floor(diffuseColor.rgb * 4.0 + 0.5) / 4.0 * (0.55 + 0.9 * h31(cell + 2.0)); // a mosaic of itself
    else if (k < 0.8) diffuseColor.rgb = vec3(0.0);
    else if (k < 0.86) { diffuseColor.rgb = vec3(0.95); pixGlow = vec3(0.2); }
    else {
      bool red = (k < 0.93) != (flick > 0.5);
      diffuseColor.rgb = red ? vec3(0.9, 0.04, 0.1) : vec3(0.08, 0.16, 0.95);
      pixGlow = diffuseColor.rgb * 0.45;
    }
    rotWet = 0.0; rotH = 0.0;
  }
}`;
const BUMP = /* glsl */ `
{
  float hx = dFdx(rotH), hy = dFdy(rotH);
  if (abs(hx) + abs(hy) > 0.0) {
    vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
    float det = dot(dpx, r1);
    vec3 bent = abs(det) * normal - sign(det) * (hx * r1 + hy * r2);
    if (dot(bent, bent) > 1e-12) normal = normalize(bent);
  }
}`;
function patch(m, kind = 0) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\n" + NOISE)
      .replace("#include <map_fragment>", "#include <map_fragment>\n" + ROT[kind] + (kind === 3 ? "vec3 pixGlow = vec3(0.0); bool pixGone = false;" : PIXEL))
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.1, rotWet);")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + BUMP)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += pixGlow;")
      .replace("#include <opaque_fragment>", kind === 3 ? "if (pixGone) discard;\n#include <opaque_fragment>" : "outgoingLight = mix(outgoingLight, vec3(0.95) * (0.9 + 0.1 * clamp(dot(outgoingLight, vec3(0.33)) * 2.0, 0.0, 1.0)), uWhite);\nif (pixGone) discard;\n#include <opaque_fragment>");
  };
  m.customProgramCacheKey = () => "rot" + kind;
  return m;
}
// polygonOffset pushes every surface a hair back, so the ink lines drawn on its edges are never lost to it
const M = (o, kind = 0) => patch(new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o }), kind);

// ---------- scene ----------
const canvasEl = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd6dc);
scene.fog = new THREE.FogExp2(0x2a0d0a, 0);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(47, 16 / 9, 0.05, 400);
camera.rotation.order = "YXZ";

const wallMap = wallTexture(), floorMap = woodTexture("#ad8a62", "70,44,20", 3, 16), woodMap = woodTexture("#c2935a", "110,70,30", 9), pineMap = woodTexture("#cfa76e", "120,80,36", 14);
const curtainMap = fabricTexture("#8f9296", 31), blanketMap = fabricTexture("#8b8d90", 41), seatMap = fabricTexture("#232427", 51), cardMap = cardboardTexture();
blanketMap.repeat.set(4, 4);
curtainMap.repeat.set(3, 2);
const weaveMap = (() => { // plain cotton: threads over and under, a little unevenness
  const [c, g] = canvas(256, 256), R = rng(77);
  g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) for (let x = 0; x < 256; x += 4) { const over = ((x + y) / 4) % 2 === 0, v = 128 + (over ? 34 : -30) + (R() - 0.5) * 30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, over ? 4 : 3, over ? 3 : 4); }
  const t = tex(c); t.repeat.set(26, 26); t.colorSpace = THREE.NoColorSpace; return t;
})();
const mat = {
  wall: M({ map: wallMap, bumpMap: wallMap, bumpScale: 0.6, roughness: 0.94 }, 1),
  ceiling: M({ color: 0xe9e8e3, roughness: 0.96 }, 1),
  floor: M({ map: floorMap, bumpMap: floorMap, bumpScale: 0.8, roughness: 0.58 }, 2),
  wood: M({ map: woodMap, bumpMap: woodMap, bumpScale: 0.5, roughness: 0.48 }),
  pine: M({ map: pineMap, bumpMap: pineMap, bumpScale: 0.5, roughness: 0.6 }),
  skirting: M({ color: 0xb79466, roughness: 0.6 }),
  black: M({ color: 0x17181a, roughness: 0.55 }),
  rubber: M({ color: 0x101112, roughness: 0.9 }),
  blackGloss: M({ color: 0x08090a, roughness: 0.18, metalness: 0.1 }),
  metal: M({ color: 0x1b1c1e, roughness: 0.35, metalness: 0.85 }),
  alu: M({ color: 0xc9cbce, roughness: 0.32, metalness: 0.9 }),
  silver: M({ color: 0xb9bcc0, roughness: 0.45, metalness: 0.55 }),
  pvc: M({ color: 0xf0f0ec, roughness: 0.4 }),
  cream: M({ color: 0xe7dfc8, roughness: 0.45 }),
  door: M({ color: 0xe8e7e2, roughness: 0.5 }),
  brass: M({ color: 0xc9a24a, roughness: 0.25, metalness: 1 }),
  gold: M({ color: 0xd9b24c, roughness: 0.3, metalness: 1 }),
  red: M({ color: 0xb32a22, roughness: 0.4 }),
  curtain: M({ map: curtainMap, bumpMap: curtainMap, bumpScale: 1, roughness: 1, side: THREE.DoubleSide }),
  blanket: M({ map: blanketMap, bumpMap: blanketMap, bumpScale: 1.5, roughness: 1 }),
  sheet: M({ color: 0x9a9da2, roughness: 0.95, bumpMap: weaveMap, bumpScale: 0.35 }), // grey, like the quilt (author 2026-11-16)
  pillow: M({ color: 0xb4b7bb, roughness: 0.9, bumpMap: weaveMap, bumpScale: 0.3 }),
  seat: M({ map: seatMap, bumpMap: seatMap, bumpScale: 1, roughness: 1 }),
  cardboard: M({ map: cardMap, bumpMap: cardMap, bumpScale: 0.6, roughness: 0.9 }),
  tape: M({ color: 0xc8b58a, roughness: 0.3, transparent: true, opacity: 0.8 }),
  paper: M({ color: 0xc79b62, roughness: 0.85 }),
  ceramic: M({ color: 0xf4f3ee, roughness: 0.18 }),
  coffee: M({ color: 0x150a05, roughness: 0.08 }),
  glass: M({ color: 0xdfeaf0, roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false }),
  lens: M({ color: 0x0a0c10, roughness: 0.05, metalness: 0.6 }),
  bulb: M({ color: 0xfff2dc, emissive: 0xffc98a, emissiveIntensity: 0 }),
  dish: M({ color: 0xf4f2ec, roughness: 0.5, emissive: 0xfff0dc, emissiveIntensity: 0 }, 3),
  led: M({ color: 0x224422, emissive: 0x59ff7a, emissiveIntensity: 1.5 }),
  ledRed: M({ color: 0x441111, emissive: 0xff3b2a, emissiveIntensity: 1.5 }),
  screen: M({ color: 0x050607, roughness: 0.12, emissive: 0x6f8fb8, emissiveIntensity: 0 }, 3),
  egg: M({ color: 0xe9cf63, roughness: 0.22, transparent: true, opacity: 0.9 }),
  socket: M({ roughness: 0.4, map: face(128, 128, "#f1f1ed", (g) => {
    g.strokeStyle = "#cfcfca"; g.lineWidth = 3; g.strokeRect(6, 6, 116, 116);
    g.fillStyle = "#2a2a2a";
    g.fillRect(44, 30, 8, 18); g.fillRect(76, 30, 8, 18); // two-pin
    g.save(); g.translate(64, 84); g.fillRect(-4, -16, 8, 16); g.rotate(1.0); g.fillRect(-22, 0, 8, 16); g.rotate(-2.0); g.fillRect(14, 0, 8, 16); g.restore();
  }) }),
};

const room = new THREE.Group();
scene.add(room);
let cur = room;
const floats = [];
/** A thing with its own origin; `float` is how far it lifts when the room stops being real. */
function G(x, y, z, build, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (o.ry) g.rotation.y = o.ry;
  cur.add(g);
  const prev = cur;
  cur = g;
  build();
  cur = prev;
  if (o.float) floats.push({ g, y, amp: o.float, ph: floats.length * 2.399, ry: o.ry ?? 0 });
  return g;
}
function place(m, x, y, z, o) {
  m.position.set(x, y, z);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = true;
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.noEdge) m.userData.noEdge = true;
  cur.add(m);
  return m;
}
/** A box at its centre. `tile` maps the texture by world position (shell pieces join without a seam); `r` rounds the edges. */
function box(w, h, d, material, x, y, z, o = {}) {
  const geo = o.r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(o.r, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d);
  if (o.tile) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const wx = p.getX(i) + x, wy = p.getY(i) + y, wz = p.getZ(i) + z;
      if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, wz / o.tile, wy / o.tile);
      else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, wx / o.tile, wz / o.tile);
      else uv.setXY(i, wx / o.tile, wy / o.tile);
    }
  }
  const m = place(new THREE.Mesh(geo, material), x, y, z, o);
  if (o.r) m.userData.edge = new THREE.BoxGeometry(w, h, d); // the drawing shows the part's true box, not its bevel
  return m;
}
function cyl(r, h, material, x, y, z, o = {}) {
  return place(new THREE.Mesh(new THREE.CylinderGeometry(o.rTop ?? r, r, h, o.seg ?? 28), material), x, y, z, o);
}
function ball(r, material, x, y, z, o = {}) {
  const m = place(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material), x, y, z, o);
  if (o.s) m.scale.set(...o.s);
  return m;
}
function torus(R, r, material, x, y, z, o = {}) {
  return place(new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 28, o.arc ?? Math.PI * 2), material), x, y, z, o);
}
function tube(points, r, material, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return place(new THREE.Mesh(new THREE.TubeGeometry(curve, o.seg ?? 48, r, 8), material), 0, 0, 0, { noEdge: true, ...o });
}
function lathe(profile, material, x, y, z, o = {}) {
  return place(new THREE.Mesh(new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), 36), material), x, y, z, { noEdge: true, ...o });
}
/** A grid of keycaps, instanced: one draw call however many keys. */
function keys(cols, rows, px, pz, w, h, d, material, x, y, z, stagger = 0) {
  const im = new THREE.InstancedMesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.22), material, cols * rows);
  const m4 = new THREE.Matrix4();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    im.setMatrixAt(r * cols + c, m4.makeTranslation((c - (cols - 1) / 2) * px + (r % 2) * stagger, 0, (r - (rows - 1) / 2) * pz));
  im.receiveShadow = true;
  im.position.set(x, y, z);
  cur.add(im);
  return im;
}
/** A flat face with a painted texture, lying on top of something (reads upright from the south). */
function label(w, d, texture, x, y, z, o = {}) {
  const m = M({ map: texture, roughness: o.rough ?? 0.35 });
  return box(w, 0.0012, d, m, x, y, z, { cast: false, noEdge: true, ...o });
}

// ================= shell =================
const T = 0.2, WT = 2.4;
const S = { noEdge: true };
box(ROOM.w + 2 * T, 0.1, ROOM.d + 2 * T, mat.floor, 0, -0.05, 0, { tile: 2.3, ...S });
const CEIL = box(ROOM.w + 2 * T, 0.1, ROOM.d + 2 * T, mat.ceiling, 0, ROOM.h + 0.05, 0, { tile: WT, ...S });
box(ROOM.w, ROOM.h, T, mat.wall, 0, ROOM.h / 2, Z0 - T / 2, { tile: WT, ...S });
const DOOR = { x0: -1.3, x1: -0.4, h: 2.05 };
box(DOOR.x0 - X0, ROOM.h, T, mat.wall, (X0 + DOOR.x0) / 2, ROOM.h / 2, Z1 + T / 2, { tile: WT, ...S });
box(X1 - DOOR.x1, ROOM.h, T, mat.wall, (X1 + DOOR.x1) / 2, ROOM.h / 2, Z1 + T / 2, { tile: WT, ...S });
box(DOOR.x1 - DOOR.x0, ROOM.h - DOOR.h, T, mat.wall, (DOOR.x0 + DOOR.x1) / 2, (ROOM.h + DOOR.h) / 2, Z1 + T / 2, { tile: WT, ...S });
function sideWall(x, win) {
  const sg = Math.sign(x), cx = x + sg * T / 2;
  box(T, win.y0, ROOM.d + 2 * T, mat.wall, cx, win.y0 / 2, 0, { tile: WT, ...S });
  box(T, ROOM.h - win.y1, ROOM.d + 2 * T, mat.wall, cx, (ROOM.h + win.y1) / 2, 0, { tile: WT, ...S });
  box(T, win.y1 - win.y0, win.z0 - (Z0 - T), mat.wall, cx, (win.y0 + win.y1) / 2, (win.z0 + Z0 - T) / 2, { tile: WT, ...S });
  box(T, win.y1 - win.y0, Z1 + T - win.z1, mat.wall, cx, (win.y0 + win.y1) / 2, (win.z1 + Z1 + T) / 2, { tile: WT, ...S });
  const w = win.z1 - win.z0, h = win.y1 - win.y0, zc = (win.z0 + win.z1) / 2, yc = (win.y0 + win.y1) / 2, f = 0.055;
  // outer frame, then a sash in every pane, the glass, the handle, the sill
  box(0.08, f, w, mat.pvc, cx, win.y0 + f / 2, zc, { r: 0.006 });
  box(0.08, f, w, mat.pvc, cx, win.y1 - f / 2, zc, { r: 0.006 });
  box(0.08, h, f, mat.pvc, cx, yc, win.z0 + f / 2, { r: 0.006 });
  box(0.08, h, f, mat.pvc, cx, yc, win.z1 - f / 2, { r: 0.006 });
  const pw = w / win.panes;
  for (let i = 0; i < win.panes; i++) {
    const pz = win.z0 + pw * (i + 0.5), s = 0.04, ih = h - 2 * f, iw = pw - (i === 0 || i === win.panes - 1 ? f : 0) - 0.01;
    if (i > 0) box(0.08, h, f, mat.pvc, cx, yc, win.z0 + pw * i, { r: 0.006 });
    box(0.05, s, iw, mat.pvc, cx - sg * 0.01, win.y0 + f + s / 2, pz, { r: 0.005 });
    box(0.05, s, iw, mat.pvc, cx - sg * 0.01, win.y1 - f - s / 2, pz, { r: 0.005 });
    box(0.05, ih, s, mat.pvc, cx - sg * 0.01, yc, pz - iw / 2 + s / 2, { r: 0.005 });
    box(0.05, ih, s, mat.pvc, cx - sg * 0.01, yc, pz + iw / 2 - s / 2, { r: 0.005 });
  }
  box(0.02, 0.11, 0.022, mat.pvc, cx - sg * 0.045, yc - 0.1, zc + (win.panes > 1 ? 0.045 : w / 2 - 0.075), { r: 0.006 });
  box(0.006, h, w, mat.glass, cx, yc, zc, { cast: false, noEdge: true });
  box(0.17, 0.028, w + 0.1, mat.pvc, x - sg * 0.065, win.y0 - 0.014, zc, { r: 0.006 });
}
const WIN = { z0: -1.55, z1: 0.15, y0: 0.9, y1: 2.3, panes: 2 };
const SLIT = { z0: 1.15, z1: 1.65, y0: 0.7, y1: 2.3, panes: 1 };
sideWall(X0, WIN);
sideWall(X1, SLIT);
// skirting with a small top bead
for (const [w, d, x, z] of [[ROOM.w, 0.014, 0, Z0 + 0.007], [0.014, ROOM.d, X0 + 0.007, 0], [0.014, ROOM.d, X1 - 0.007, 0], [X1 - DOOR.x1, 0.014, (X1 + DOOR.x1) / 2, Z1 - 0.007], [DOOR.x0 - X0, 0.014, (X0 + DOOR.x0) / 2, Z1 - 0.007]])
  box(w, 0.085, d, mat.skirting, x, 0.0425, z, { cast: false, r: 0.004 });
// ceiling light (a plain dish), the air-conditioner's pipe hole and its cable
const DISH = lathe([[0, 0], [0.16, 0], [0.17, -0.02], [0.14, -0.06], [0, -0.075]], mat.dish, 0.1, ROOM.h, 0.1, { cast: false });
cyl(0.035, 0.012, mat.pvc, X0 + 0.75, 2.5, Z0 + 0.006, { rx: Math.PI / 2 });
tube([[X0 + 0.75, 2.5, Z0 + 0.02], [X0 + 0.72, 2.3, Z0 + 0.03], [X0 + 0.86, 2.12, Z0 + 0.03], [X0 + 1.0, 2.3, Z0 + 0.03], [X0 + 1.02, 2.62, Z0 + 0.02]], 0.011, mat.cream);
// curtains: a rod, rings, cloth that hangs in folds
function curtain(w, h, x, y, z, ry, folds, seed) {
  const g = new THREE.PlaneGeometry(w, h, 90, 12), p = g.attributes.position, R = rng(seed), ph = R() * 6;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w, v = p.getY(i) / h + 0.5;
    p.setZ(i, Math.sin(u * folds * 6.283 + ph) * 0.034 * (0.55 + 0.45 * (1 - v)) + Math.sin(u * folds * 12.566 + ph * 2) * 0.008 + Math.sin(v * 5 + u * 9) * 0.004);
  }
  g.computeVertexNormals();
  place(new THREE.Mesh(g, mat.curtain), x, y, z, { ry, noEdge: true });
}
// to the floor, all three (author 2026-11-16)
curtain(0.52, 2.42, X0 + 0.11, 1.225, WIN.z1 + 0.3, Math.PI / 2, 5, 1);
curtain(0.4, 2.42, X0 + 0.11, 1.225, WIN.z0 - 0.21, Math.PI / 2, 4, 2);
curtain(0.32, 2.42, X1 - 0.11, 1.225, SLIT.z0 - 0.18, -Math.PI / 2, 4, 3);
cyl(0.011, 2.7, mat.alu, X0 + 0.11, 2.46, -0.65, { rx: Math.PI / 2 });
for (const z of [-1.99, 0.69]) ball(0.02, mat.alu, X0 + 0.11, 2.46, z);
for (let i = 0; i < 7; i++) torus(0.016, 0.003, mat.alu, X0 + 0.11, 2.46, WIN.z1 + 0.08 + i * 0.075, { ry: 0 });
cyl(0.009, 0.7, mat.alu, X1 - 0.11, 2.47, SLIT.z0 + 0.05, { rx: Math.PI / 2 });

// ================= desk =================
G(DESK.x, 0, DESK.z, () => {
  const { w, d, h } = DESK;
  box(w, 0.032, d, mat.wood, 0, h - 0.016, 0, { r: 0.005 });
  box(w - 0.1, 0.012, d - 0.08, mat.wood, 0, h - 0.038, 0); // shadow line under the top
  // apron: back and sides, and two drawer fronts with a real gap between them
  box(w - 0.12, 0.1, 0.018, mat.wood, 0, h - 0.094, -d / 2 + 0.06);
  for (const s of [-1, 1]) box(0.018, 0.1, d - 0.12, mat.wood, s * (w / 2 - 0.06), h - 0.094, 0);
  for (const s of [-1, 1]) {
    box((w - 0.13) / 2 - 0.004, 0.094, 0.018, mat.wood, s * ((w - 0.13) / 4 + 0.002), h - 0.094, d / 2 - 0.06, { r: 0.003 });
    box((w - 0.13) / 2 - 0.02, 0.006, 0.3, mat.black, s * (w - 0.13) / 4, h - 0.142, d / 2 - 0.2, { cast: false }); // the dark under the drawer
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.058, h - 0.032, 0.058, mat.wood, sx * (w / 2 - 0.045), (h - 0.032) / 2, sz * (d / 2 - 0.045), { r: 0.004 });
});
const top = DESK.h;
function monitor(x, ry) {
  return G(DESK.x + x, top, DESK.z - 0.2 + Math.abs(ry) * 0.12, () => {
    box(0.25, 0.01, 0.18, mat.alu, 0, 0.005, 0, { r: 0.004 });
    box(0.05, 0.27, 0.022, mat.alu, 0, 0.135, -0.03, { r: 0.006 });
    torus(0.02, 0.005, mat.black, 0, 0.09, -0.018); // the cable hole
    box(0.07, 0.07, 0.03, mat.black, 0, 0.33, -0.005); // mount
    box(0.545, 0.325, 0.028, mat.black, 0, 0.36, 0.022, { r: 0.006 });
    box(0.533, 0.3, 0.002, mat.screen, 0, 0.367, 0.0365, { cast: false, noEdge: true });
    box(0.545, 0.016, 0.003, mat.blackGloss, 0, 0.206, 0.0365, { cast: false, noEdge: true }); // chin
    box(0.022, 0.004, 0.002, mat.silver, 0, 0.206, 0.0385, { cast: false, noEdge: true }); // badge
    ball(0.0025, mat.led, 0.25, 0.206, 0.038, { cast: false });
  }, { ry });
}
// 27-inch, not 24: seen from across the room the first pair were small and low against someone sitting there (author 2026-11-16).
// The top edge now comes to a seated eye (about 1.2 m).
for (const [x, ry] of [[-0.3, 0.06], [0.3, -0.06]]) { const m = monitor(x, ry); m.scale.set(1.08, 1.16, 1.08); } // as in the photo: nearly in line, taller than wide screens usually are, standing clear of the desk
// ---- small makers for precise things: rounded plates, pixel type, printed legends ----
function RR(w, h, r) { const sh = new THREE.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; }
const FONT = { l: "01100,00100,00100,00100,00100,00100,01110", e: "00000,00000,01110,10001,11111,10000,01110", a: "00000,00000,01110,00001,01111,10001,01111", r: "00000,00000,10110,11001,10000,10000,10000", n: "00000,00000,10110,11001,10001,10001,10001", 0: "01110,10001,10011,10101,11001,10001,01110", 7: "11111,00001,00010,00100,01000,01000,01000", 3: "11110,00001,00001,01110,00001,00001,11110", 4: "00010,00110,01010,10010,11111,00010,00010", ".": "00000,00000,00000,00000,00000,01100,01100" };
/** A liquid-crystal screen: every character is set from its 5 × 7 dots, the way the thing itself does it. */
function lcdTex(text, w, h, px, draw) {
  return face(w, h, "#a7b3a6", (g) => {
    g.fillStyle = "rgba(255,255,255,.07)"; for (let y = 0; y < h; y += px) g.fillRect(0, y, w, 1); for (let x = 0; x < w; x += px) g.fillRect(x, 0, 1, h); // the grid of unlit dots
    g.fillStyle = "#1c2420";
    const adv = { ".": 3 }, total = [...text].reduce((q, ch) => q + (adv[ch] ?? 6), -1) * px; let x0 = Math.round((w - total) / 2 / px) * px; const y0 = Math.round((h - 7 * px) / 2 / px) * px;
    for (const ch of text) { const rows = FONT[ch].split(","), cut = ch === "." ? 1 : 0; rows.forEach((row, y) => [...row].forEach((b, x) => { if (b === "1") g.fillRect(x0 + (x - cut) * px, y0 + y * px, px - 1, px - 1); })); x0 += (adv[ch] ?? 6) * px; }
    if (draw) draw(g);
  });
}
/** What is printed on a block of keys: one sheet, lying a hair above the caps. */
function legend(w, d, cols, rows, labels, x, y, z, color = "#2a2a2a", size = 0.52) {
  const cw = 40, [c, g] = canvas(cols * cw, rows * cw);
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(cw * size)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  labels.forEach((t, i) => { if (t && t !== " ") g.fillText(t, ((i % cols) + 0.5) * cw, (Math.floor(i / cols) + 0.52) * cw); });
  const t = tex(c, false);
  return box(w, 0.0002, d, M({ map: t, transparent: true, depthWrite: false, roughness: 0.6 }, 3), x, y, z, { cast: false, noEdge: true });
}
const glassDark = M({ color: 0x0c0e10, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }, 3);
const lcdMat = (t) => M({ map: t, roughness: 0.22 });

// keyboard: a full board, 104 caps, their legends, three lamps
{
G(DESK.x - 0.06, top, DESK.z + 0.12, () => {
  box(0.452, 0.014, 0.142, mat.black, 0, 0.007, 0, { r: 0.005 });
  const P = 0.0186, K = 0.0158, yk = 0.0172, kx = -0.066;
  keys(15, 4, P, P, K, 0.0062, K, mat.rubber, kx, yk, -0.0105);           // number row to the shift row
  keys(13, 1, 0.0214, 0, 0.0164, 0.005, 0.0125, mat.rubber, kx, yk - 0.0006, -0.0585); // function row, shorter keys
  for (const [x, w] of [[-0.13, 0.024], [-0.104, 0.02], [-0.081, 0.02], [-0.0085, 0.118], [0.064, 0.02], [0.087, 0.02], [0.112, 0.024]]) keys(1, 1, 0, 0, w, 0.0062, K, mat.rubber, kx + x, yk, 0.0453); // the bottom row, with its long bar
  keys(4, 5, P, P, K, 0.0062, K, mat.rubber, 0.183, yk, 0.008);           // the number pad
  legend(15 * P, 4 * P, 15, 4, [..."`1234567890-=←", " ", "⇥", ..."QWERTYUIOP[]\\", "⇪", ..."ASDFGHJKL;'", "↵", " ", " ", "⇧", ..."ZXCVBNM,./", "⇧", " ", "↑", " "], kx, yk + 0.0034, -0.0105, "#c9ccd0", 0.4);
  legend(4 * P, 5 * P, 4, 5, ["⇭", "/", "*", "-", "7", "8", "9", "+", "4", "5", "6", " ", "1", "2", "3", "↵", "0", " ", ".", " "], 0.183, yk + 0.0034, 0.008, "#c9ccd0", 0.4);
  for (let i = 0; i < 3; i++) ball(0.0016, i === 0 ? mat.led : mat.rubber, 0.165 + i * 0.012, 0.0142, -0.06, { cast: false });
}, { float: 0.1 });
G(DESK.x + 0.26, top, DESK.z + 0.13, () => { // mouse: two buttons parted by a seam, a wheel, a waist
  ball(0.031, mat.black, 0, 0.011, 0, { s: [1, 0.66, 1.72] });
  box(0.0008, 0.004, 0.045, mat.rubber, 0, 0.0288, -0.026, { cast: false, noEdge: true });
  cyl(0.0052, 0.0052, M({ color: 0x55585c, roughness: 0.6 }), 0, 0.0292, -0.026, { rz: Math.PI / 2, seg: 18 });
  for (const k of [-1, 1]) box(0.002, 0.008, 0.03, mat.rubber, k * 0.03, 0.012, 0.004, { r: 0.0009, cast: false });
}, { float: 0.14 });
// their leads: across the desk between the monitor stands, over the back edge, down behind the desk to the tower. Whole.
{
  const kx = DESK.x - 0.01, back = DESK.z - DESK.d / 2, tw = [X0 + 0.44, 0.3, Z0 + 0.2];
  tube([[kx, top + 0.012, DESK.z + 0.05], [kx + 0.015, top + 0.004, DESK.z + 0.0], [DESK.x - 0.03, top + 0.003, DESK.z - 0.12], [DESK.x - 0.01, top + 0.003, DESK.z - 0.27], [DESK.x - 0.03, top + 0.002, back + 0.01], [DESK.x - 0.05, top - 0.05, back - 0.025], [DESK.x - 0.3, 0.42, Z0 + 0.03], [X0 + 0.62, 0.22, Z0 + 0.06], tw], 0.0022, mat.rubber, { seg: 120 });
  tube([[DESK.x + 0.26, top + 0.022, DESK.z + 0.08], [DESK.x + 0.25, top + 0.004, DESK.z + 0.03], [DESK.x + 0.16, top + 0.003, DESK.z - 0.1], [DESK.x + 0.06, top + 0.003, DESK.z - 0.26], [DESK.x + 0.02, top + 0.002, back + 0.01], [DESK.x + 0.0, top - 0.06, back - 0.025], [DESK.x - 0.28, 0.36, Z0 + 0.035], [X0 + 0.64, 0.26, Z0 + 0.08], [tw[0], tw[1] + 0.04, tw[2]]], 0.0018, mat.rubber, { seg: 120 });
}
// what use leaves on a desk top: two rings from the mug, scratches, the patch the mouse has polished
box(DESK.w - 0.02, 0.0002, DESK.d - 0.02, M({ transparent: true, depthWrite: false, roughness: 0.5, map: face(1024, 448, "rgba(0,0,0,0)", (g) => {
  g.clearRect(0, 0, 1024, 448);
  const R = rng(91), px = (x) => (x / DESK.w + 0.5) * 1024, pz = (z) => (z / DESK.d + 0.5) * 448;
  for (const [x, z, r, a] of [[-0.4, 0.0, 26, 0.3], [-0.36, 0.06, 26, 0.16], [-0.47, 0.11, 25, 0.1]]) { g.strokeStyle = `rgba(92,52,20,${a})`; g.lineWidth = 2.2; g.beginPath(); g.arc(px(x), pz(z), r, 0.3 + R(), 5.6 + R()); g.stroke(); }
  for (let i = 0; i < 46; i++) { g.strokeStyle = `rgba(255,244,220,${0.05 + R() * 0.1})`; g.lineWidth = 0.6 + R(); const x = R() * 1024, y = R() * 448, a = (R() - 0.5) * 1.2, l = 10 + R() * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  blotch(g, px(0.3), pz(0.14), 70, "255,246,226", 0.14); // polished
  blotch(g, px(-0.02), pz(0.3), 150, "70,44,20", 0.08);  // where the forearms rest
  for (let i = 0; i < 5; i++) { g.strokeStyle = "rgba(60,60,70,.25)"; g.lineWidth = 1; const x = px(0.55) + i * 5, y = pz(0.27); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 12); g.stroke(); } // a tally in pencil
}) }, 3), DESK.x, top + 0.0002, DESK.z, { cast: false, noEdge: true });
}
// lamp: weighted base, a bent arm, a spun shade
const LAMP = { x: DESK.x + 0.66, z: DESK.z - 0.12 };
cyl(0.075, 0.016, mat.black, LAMP.x, top + 0.008, LAMP.z);
cyl(0.014, 0.03, mat.black, LAMP.x, top + 0.03, LAMP.z);
tube([[LAMP.x, top + 0.03, LAMP.z], [LAMP.x + 0.012, top + 0.2, LAMP.z], [LAMP.x - 0.01, top + 0.35, LAMP.z], [LAMP.x - 0.07, top + 0.405, LAMP.z + 0.015], [LAMP.x - 0.11, top + 0.4, LAMP.z + 0.02]], 0.008, mat.black);
const shadeMat = M({ color: 0x17181a, roughness: 0.5, side: THREE.DoubleSide });
const SHADE = lathe([[0.022, 0.1], [0.03, 0.095], [0.045, 0.06], [0.075, 0], [0.077, -0.004]], shadeMat, LAMP.x - 0.15, top + 0.37, LAMP.z + 0.03, { rz: -0.95 });
const bulb = ball(0.024, mat.bulb, LAMP.x - 0.128, top + 0.386, LAMP.z + 0.03, { cast: false });
// chair: the one in the photo — a plain visitor's chair, four tube legs, a padded seat and a padded back with a
// hand slot — but made of soft shapes: legs that splay, pads that dish and curve, set a little off square.
function bent(w, h, d, sx, sy, fn) { const g = new THREE.BoxGeometry(w, h, d, sx, sy, 2), P = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); fn(v); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; }
const chairFab = M({ color: 0x26282c, roughness: 0.97 });
G(DESK.x - 0.3, 0, DESK.z + 0.72, () => {
  for (const sd of [-1, 1]) {
    tube([[sd * 0.235, 0.006, -0.24], [sd * 0.215, 0.3, -0.21], [sd * 0.205, 0.43, -0.19], [sd * 0.205, 0.445, -0.12], [sd * 0.205, 0.445, 0.14], [sd * 0.205, 0.47, 0.2], [sd * 0.2, 0.62, 0.235], [sd * 0.19, 0.86, 0.275]], 0.0105, mat.metal, { seg: 64 });
    tube([[sd * 0.205, 0.445, 0.13], [sd * 0.212, 0.38, 0.19], [sd * 0.24, 0.006, 0.26]], 0.0105, mat.metal);
    cyl(0.013, 0.012, mat.rubber, sd * 0.235, 0.006, -0.24);
    cyl(0.013, 0.012, mat.rubber, sd * 0.24, 0.006, 0.26);
  }
  tube([[-0.205, 0.44, -0.16], [0.205, 0.44, -0.16]], 0.009, mat.metal, { seg: 2 });
  place(new THREE.Mesh(bent(0.45, 0.06, 0.43, 14, 2, (v) => { const f = Math.max(0, -v.z - 0.1); v.y -= f * f * 2.4; if (v.y > 0) v.y -= 0.012 * (1 - Math.min(1, (v.x / 0.225) ** 2)) * (1 - Math.min(1, (v.z / 0.215) ** 2)); const e = Math.max(0, Math.abs(v.x) - 0.19) + Math.max(0, Math.abs(v.z) - 0.18); v.y -= e * e * 5; }), chairFab), 0, 0.478, 0, {});
  G(0, 0.72, 0.262, () => {
    place(new THREE.Mesh(bent(0.42, 0.3, 0.04, 16, 12, (v) => { v.z -= v.x * v.x * 1.1; const c = Math.max(0, Math.abs(v.x) - 0.15) * Math.max(0, Math.abs(v.y) - 0.09); v.y -= Math.sign(v.y) * c * 14; }), chairFab), 0, 0, 0, {});
    box(0.11, 0.028, 0.012, M({ color: 0x08090a, roughness: 0.6 }), 0, 0.085, 0.016, { r: 0.01, cast: false, noEdge: true }); // the hand slot
  });
  cur.children[cur.children.length - 1].rotation.x = 0.17;
}, { float: 0.35, ry: -0.22 });
// tower, power strip, sockets, cables
G(X0 + 0.66, 0, Z0 + 0.42, () => {
  box(0.19, 0.42, 0.42, mat.black, 0, 0.215, 0, { r: 0.006 });
  box(0.17, 0.4, 0.004, mat.blackGloss, 0, 0.215, 0.211, { cast: false });
  ball(0.006, mat.led, 0.06, 0.38, 0.214, { cast: false });
  for (const s of [-1, 1]) box(0.19, 0.008, 0.03, mat.rubber, 0, 0.004, s * 0.17);
});
G(DESK.x + 0.15, 0, Z0 + 0.32, () => {
  box(0.3, 0.032, 0.056, mat.pvc, 0, 0.016, 0, { r: 0.006 });
  for (let i = 0; i < 4; i++) box(0.045, 0.002, 0.04, mat.socket, -0.1 + i * 0.058, 0.033, 0, { cast: false, noEdge: true });
  box(0.02, 0.008, 0.014, mat.ledRed, 0.132, 0.034, 0, { r: 0.002, cast: false });
}, { ry: 0.1, float: 0.2 });
for (const [x, y] of [[DESK.x + 0.1, 0.32], [DESK.x + 0.2, 0.32], [0.95, 1.5]]) box(0.086, 0.086, 0.009, mat.socket, x, y, Z0 + 0.0045, { r: 0.003, cast: false });
box(0.03, 0.04, 0.03, mat.pvc, DESK.x + 0.1, 0.32, Z0 + 0.025, { r: 0.006 }); // a plug in it
tube([[DESK.x - 0.3, top + 0.08, DESK.z - 0.19], [DESK.x - 0.24, 0.5, Z0 + 0.05], [DESK.x + 0.02, 0.2, Z0 + 0.05], [DESK.x + 0.1, 0.31, Z0 + 0.04]], 0.0045, mat.rubber);
tube([[DESK.x + 0.26, top + 0.08, DESK.z - 0.19], [DESK.x + 0.4, 0.45, Z0 + 0.07], [DESK.x + 0.32, 0.07, Z0 + 0.18], [DESK.x + 0.22, 0.03, Z0 + 0.3]], 0.0045, mat.rubber);
tube([[X0 + 0.42, 0.3, Z0 + 0.2], [X0 + 0.7, 0.02, Z0 + 0.14], [DESK.x - 0.12, 0.012, Z0 + 0.26], [DESK.x + 0.01, 0.02, Z0 + 0.31]], 0.0045, mat.rubber);
tube([[LAMP.x, top + 0.01, LAMP.z - 0.07], [LAMP.x + 0.02, top - 0.02, Z0 + 0.03], [LAMP.x - 0.1, 0.3, Z0 + 0.03], [DESK.x + 0.26, 0.05, Z0 + 0.2]], 0.003, mat.rubber);

// carton between the desk and the bed: five panels, a hand hole, packing tape, flaps left open
const CARTON = G(0.46, 0, Z0 + 0.95, () => {
  const w = 0.4, h = 0.33, d = 0.34, t = 0.006;
  const lid = G(0, h, 0, () => { box(w, t, d, mat.cardboard, 0, 0, 0); box(w + 0.002, 0.001, 0.05, mat.tape, 0, t / 2 + 0.0006, 0, { cast: false, noEdge: true }); for (const k of [-1, 1]) box(0.05, 0.07, 0.001, mat.tape, 0, -0.035, k * (d / 2 + 0.0008), { cast: false, noEdge: true }); });
  lid.userData.lid = true; // day 1: it has only just come, still taped shut
  box(w, t, d, mat.cardboard, 0, t / 2, 0);
  for (const s of [-1, 1]) {
    box(w, h, t, mat.cardboard, 0, h / 2, s * (d / 2 - t / 2));
    box(t, h, d, mat.cardboard, s * (w / 2 - t / 2), h / 2, 0);
    box(w - 0.01, t, d / 2, mat.cardboard, 0, h + 0.03 * (s > 0 ? 1 : 2), s * (d / 2 + 0.07), { rx: s * (s > 0 ? 0.5 : 0.95) }).userData.flap = true;
    box(d / 2 - 0.02, t, d - 0.02, mat.cardboard, s * (w / 2 + 0.05), h - 0.03, 0, { rz: s * -1.1 }).userData.flap = true;
  }
  box(0.09, 0.03, 0.002, mat.black, 0, h * 0.66, d / 2 + 0.0005, { r: 0.0009, cast: false, noEdge: true }); // hand hole
  box(0.05, h * 0.5, 0.001, mat.tape, 0, h * 0.25, d / 2 + 0.0006, { cast: false, noEdge: true });
}, { ry: 0.08, float: 0.3 });

// ================= bed =================
const BED = { x: X1 - 0.5, w: 0.95, z0: Z0 + 0.3, len: 1.95 };
const bz = BED.z0 + BED.len / 2;
const bedMap = woodTexture("#c68a49", "105,58,18", 17);
const bedWood = M({ map: bedMap, bumpMap: bedMap, bumpScale: 0.5, roughness: 0.55 });
{ // the frame: square posts, a rail down each side, two rails across the foot, the boards the mattress lies on
  const hw = BED.w / 2 + 0.03, zf = BED.z0 + BED.len + 0.035;
  for (const k of [-1, 1]) {
    box(0.032, 0.15, BED.len + 0.04, bedWood, BED.x + k * hw, 0.315, bz, { r: 0.005 });
    box(0.062, 0.64, 0.062, bedWood, BED.x + k * hw, 0.32, zf, { r: 0.006 });
    box(0.07, 0.014, 0.07, bedWood, BED.x + k * hw, 0.647, zf, { r: 0.004 }); // the cap on the post
  }
  for (const y of [0.53, 0.36]) box(BED.w + 0.01, 0.085, 0.03, bedWood, BED.x, y, zf, { r: 0.006 });
  for (let i = 0; i < 9; i++) box(BED.w, 0.016, 0.07, mat.pine, BED.x, 0.3, BED.z0 + 0.12 + i * 0.215, { cast: false });
}
box(BED.w, 0.17, BED.len, mat.sheet, BED.x, 0.41, bz, { r: 0.055 });
{ // the blanket: thrown over the whole bed, pillow and all; long folds, creases, and it hangs down the open side
  const W = BED.w + 0.56, L = BED.len - 0.44, g = new THREE.BoxGeometry(W, 0.03, L, 130, 1, 170), p = g.attributes.position, edge = BED.w / 2 + 0.012;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const zl = z + L / 2; // 0 at the head
    let h = 0.02 * Math.sin(x * 7 + z * 3.1) * Math.sin(z * 5.3 - x * 2.2) + 0.017 * Math.pow(1 - Math.abs(Math.sin(z * 8 + x * 5 + Math.sin(x * 6) * 1.2)), 3) + 0.012 * Math.pow(1 - Math.abs(Math.sin(x * 14 - z * 6 + Math.sin(z * 4))), 4) + 0.007 * Math.pow(1 - Math.abs(Math.sin(x * 23 + z * 19 + Math.sin(z * 11))), 5) + 0.003 * Math.sin(x * 57 + z * 43);
    h += 0.062 * Math.max(0, 1 - Math.pow(Math.max(0, zl) / 0.1, 2.2)) * (1 - ss(0.3, 0.46, Math.abs(x))) + 0.012 * gauss((zl - 0.34) / 0.12) * Math.sin(x * 9); // its top edge lies up on the lower part of the pillow; the rest of the pillow shows
    { const rim = Math.min(1, Math.min(L / 2 - Math.abs(z), W / 2 - Math.abs(p.getX(i))) / 0.03); y *= 0.08 + 0.92 * rim * rim; } // it thins to nothing at its edges: cloth, not a cut slab
    if (x < -edge) { const over = -edge - x, drop = Math.min(over, 0.17 + 0.03 * Math.sin(z * 3.3)); y -= drop + 0.012; x = -edge - 0.05 - 0.012 * (1 - Math.exp(-over * 14)) - 0.007 * Math.sin(z * 17 + over * 9) * Math.min(1, over * 6); h *= Math.max(0, 1 - over * 9); } // clear of the side rail, and not so long that the legs are hidden
    else if (x > edge) { const over = x - edge; y -= over * 0.35; x = edge + over * 0.02; h *= 0.3; } // the wall side: just tucked
    p.setXYZ(i, x, y + h, z);
  }
  g.computeVertexNormals();
  place(new THREE.Mesh(g, mat.blanket), BED.x, 0.512, bz + 0.22, { noEdge: true });
}
{ // the pillow: full in the middle, pinched at its seams, a dent where a head was
  const g = new THREE.BoxGeometry(0.64, 0.15, 0.4, 28, 6, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), fx = 1 - Math.pow(Math.abs(x) / 0.32, 3.2), fz = 1 - Math.pow(Math.abs(z) / 0.2, 3.2), puff = Math.max(0.06, fx * fz);
    let ny = y * puff;
    if (y > 0) ny -= 0.028 * gauss((x - 0.04) / 0.13) * gauss((z + 0.01) / 0.1) - 0.006 * Math.sin(x * 21 + z * 13) * fx * fz;
    p.setXYZ(i, x * (1 + 0.02 * Math.sin(z * 30)), ny, z * (1 + 0.02 * Math.sin(x * 23)));
  }
  g.computeVertexNormals();
  place(new THREE.Mesh(g, mat.pillow), BED.x + 0.01, 0.553, BED.z0 + 0.27, { noEdge: true, ry: 0.07, rx: -0.05 });
}
// the headboard: a shelf unit. Books and a clock on top, a cubby under them where the phone charges
G(BED.x, 0, BED.z0, () => {
  const w = BED.w + 0.06, d = 0.27, zc = -d / 2 - 0.01;
  for (const k of [-1, 1]) box(0.03, 0.98, d, bedWood, k * (w / 2 - 0.015), 0.49, zc, { r: 0.005 });
  box(w, 0.98, 0.014, bedWood, 0, 0.49, zc - d / 2 + 0.008);           // back
  box(w, 0.5, 0.02, bedWood, 0, 0.25, zc + d / 2 - 0.01);             // front, as high as the mattress
  box(w - 0.06, 0.022, d - 0.02, bedWood, 0, 0.535, zc, { r: 0.004 }); // the cubby's floor
  box(w, 0.024, d, bedWood, 0, 0.76, zc, { r: 0.005 });               // the top shelf
  box(w, 0.09, 0.018, bedWood, 0, 0.815, zc - d / 2 + 0.018, { r: 0.004 });
  const R = rng(77), cols = ["#e9e6dc", "#22262b", "#2f6f73", "#d9d2c0", "#15171a", "#8a2f2a", "#f1efe8", "#3a4b63"];
  const spine = (c, i) => M({ roughness: 0.7, map: face(64, 256, c, (g) => { g.fillStyle = i % 3 === 1 ? "rgba(255,255,255,.75)" : "rgba(20,20,20,.7)"; g.fillRect(22, 30 + (i * 13) % 40, 20, 90 + (i * 29) % 60); g.fillRect(18, 214, 28, 6); }) });
  let x = 0.1;
  for (let i = 0; i < 8; i++) { const bw = 0.022 + R() * 0.03, bh = 0.19 + R() * 0.06, lean = i === 0 ? 0.2 : 0; G(x + bw / 2 + (lean ? 0.02 : 0), 0.772 + bh / 2, zc, () => { box(bw, bh, 0.15, spine(cols[i % cols.length], i), 0, 0, 0, { rz: lean, r: 0.002 }); box(bw - 0.004, bh - 0.006, 0.146, mat.sheet, 0, 0, 0.004, { rz: lean, cast: false }); }, { float: 0.1 + R() * 0.35 }); x += bw + 0.003; }
  for (let i = 0; i < 3; i++) box(0.2 - i * 0.015, 0.027, 0.15, spine(cols[(i + 2) % cols.length], i + 3), -0.29, 0.786 + i * 0.028, zc, { ry: i * 0.08, r: 0.002 });
  G(-0.06, 0.772, zc + 0.02, () => { // a twin-bell alarm clock
    cyl(0.04, 0.03, mat.black, 0, 0.05, 0, { rx: Math.PI / 2, seg: 36 });
    cyl(0.035, 0.002, M({ roughness: 0.4, map: face(128, 128, "#f4f2ea", (g) => { g.translate(64, 64); g.fillStyle = "#1b1b1d"; for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * Math.PI / 6); g.fillRect(-2, -56, 4, i % 3 ? 8 : 15); g.restore(); } g.save(); g.rotate(-0.9); g.fillRect(-3, -34, 6, 38); g.restore(); g.save(); g.rotate(2.2); g.fillRect(-2, -50, 4, 56); g.restore(); g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); }) }), 0, 0.05, 0.0155, { rx: Math.PI / 2, seg: 36, cast: false });
    for (const k of [-1, 1]) { ball(0.017, mat.black, k * 0.022, 0.098, 0, { s: [1, 0.72, 1] }); cyl(0.002, 0.014, mat.black, k * 0.022, 0.088, 0, { rz: -k * 0.35 }); cyl(0.004, 0.02, mat.black, k * 0.024, 0.008, 0.004, { rz: k * 0.35 }); }
    torus(0.02, 0.0018, mat.black, 0, 0.108, 0, { arc: Math.PI });
    box(0.003, 0.02, 0.003, mat.black, 0, 0.1, 0);
  }, { ry: -0.2, float: 0.2 });
  G(-0.33, 0.546, zc - 0.02, () => { box(0.068, 0.14, 0.008, mat.blackGloss, 0, 0.07, 0, { r: 0.004, rx: -0.2 }); box(0.012, 0.006, 0.006, mat.pvc, 0, 0.003, 0.016); }, { ry: 0.3 }); // the phone, propped, charging
});
tube([[BED.x - 0.33, 0.55, BED.z0 - 0.135], [BED.x - 0.36, 0.56, BED.z0 - 0.03], [BED.x - 0.44, 0.5, BED.z0 + 0.02], [BED.x - 0.5, 0.3, BED.z0 - 0.02], [BED.x - 0.56, 0.2, BED.z0 - 0.2], [BED.x - 0.6, 0.3, Z0 + 0.03]], 0.0022, mat.pvc); // its lead, over the edge and down to the wall
box(0.086, 0.086, 0.009, mat.socket, BED.x - 0.6, 0.3, Z0 + 0.0045, { r: 0.003, cast: false });
box(0.026, 0.03, 0.028, mat.pvc, BED.x - 0.6, 0.3, Z0 + 0.02, { r: 0.005 });

// ================= door =================
const dx = (DOOR.x0 + DOOR.x1) / 2, dw = DOOR.x1 - DOOR.x0;
G(dx, 0, Z1, () => {
  box(dw - 0.07, DOOR.h - 0.035, 0.042, mat.door, 0, (DOOR.h - 0.035) / 2 + 0.005, 0.05, { r: 0.003 }); // a plain flush door
  for (const s of [-1, 1]) { box(0.065, DOOR.h, 0.15, mat.pvc, s * (dw / 2 - 0.02), DOOR.h / 2, 0.03, { r: 0.004 }); box(0.04, DOOR.h + 0.02, 0.012, mat.pvc, s * (dw / 2 + 0.03), DOOR.h / 2 + 0.01, -0.006, { r: 0.003 }); } // jamb and architrave
  box(dw, 0.065, 0.15, mat.pvc, 0, DOOR.h - 0.012, 0.03, { r: 0.004 });
  box(dw + 0.1, 0.04, 0.012, mat.pvc, 0, DOOR.h + 0.04, -0.006, { r: 0.003 });
  box(dw - 0.08, 0.012, 0.09, mat.alu, 0, 0.006, 0.03, { cast: false }); // the threshold strip
  // seen from inside: hinges on the east jamb; knob, slide bolt and chain on the west; a spy-hole
  const hx = -(dw / 2 - 0.13), face0 = 0.029;
  cyl(0.026, 0.008, mat.alu, hx, 1.0, face0 - 0.004, { rx: Math.PI / 2, seg: 28 });
  cyl(0.011, 0.04, mat.alu, hx, 1.0, face0 - 0.024, { rx: Math.PI / 2 });
  ball(0.028, mat.alu, hx, 1.0, face0 - 0.056, { s: [1, 1, 0.82] });
  box(0.004, 0.012, 0.003, mat.black, hx, 1.0, face0 - 0.08, { cast: false, noEdge: true });
  box(0.11, 0.034, 0.006, mat.brass, hx + 0.03, 1.38, face0 - 0.003, { r: 0.003 });              // bolt plate
  for (const x of [-0.02, 0.05]) box(0.012, 0.022, 0.012, mat.brass, hx + 0.03 + x, 1.38, face0 - 0.011, { r: 0.003 }); // its two guides
  cyl(0.0055, 0.13, mat.brass, hx + 0.01, 1.38, face0 - 0.012, { rz: Math.PI / 2, seg: 12 });
  cyl(0.004, 0.02, mat.brass, hx + 0.06, 1.38, face0 - 0.022, { rx: Math.PI / 2 }); ball(0.007, mat.brass, hx + 0.06, 1.38, face0 - 0.034);
  box(0.022, 0.05, 0.014, mat.brass, -dw / 2 + 0.012, 1.38, -0.05, { r: 0.003 });                // the keep on the jamb
  box(0.1, 0.024, 0.005, mat.brass, hx + 0.03, 1.3, face0 - 0.003, { r: 0.002 });                // the chain's track
  { // the chain: hooked on the frame, sagging to the track
    const a = [-dw / 2 + 0.012, 1.35, -0.058], b = [hx + 0.07, 1.3, face0 - 0.008], n = 15;
    for (let i = 0; i <= n; i++) { const u = i / n, sag = Math.sin(u * Math.PI) * 0.09; torus(0.0075, 0.002, mat.brass, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag, a[2] + (b[2] - a[2]) * u - sag * 0.15, { ry: i % 2 ? Math.PI / 2 : 0, rz: (u - 0.5) * 1.2, cast: false }); }
  }
  cyl(0.011, 0.006, mat.brass, 0, 1.5, face0 - 0.003, { rx: Math.PI / 2, seg: 20 }); cyl(0.006, 0.007, mat.lens, 0, 1.5, face0 - 0.004, { rx: Math.PI / 2, seg: 16 }); // spy-hole
  for (const y of [0.25, 1.05, 1.8]) { cyl(0.007, 0.1, mat.alu, dw / 2 - 0.052, y, 0.02, { seg: 10 }); box(0.03, 0.09, 0.002, mat.alu, dw / 2 - 0.07, y, 0.027, { cast: false }); }
});
let ROCKER;
const SWITCH = G(DOOR.x0 - 0.2, 1.3, Z1, () => { // the wall switch by the door: it works the ceiling light
  box(0.086, 0.086, 0.009, mat.pvc, 0, 0, -0.0045, { r: 0.003, cast: false });
  ROCKER = box(0.04, 0.06, 0.006, mat.pvc, 0, 0, -0.011, { r: 0.002, rx: 0.08, cast: false });
});
G(DOOR.x1 + 0.55, 2.25, Z1, () => { // the consumer unit, high on the wall
  box(0.3, 0.2, 0.06, mat.pvc, 0, 0, -0.03, { r: 0.006 });
  box(0.26, 0.16, 0.004, M({ color: 0xd9dde0, roughness: 0.3, transparent: true, opacity: 0.7 }, 3), 0, 0, -0.062, { r: 0.002, cast: false });
  for (let i = 0; i < 6; i++) { box(0.016, 0.06, 0.012, M({ color: 0xe6e6e2, roughness: 0.5 }), -0.07 + i * 0.022, 0, -0.056, { cast: false }); box(0.008, 0.016, 0.01, i === 0 ? mat.red : mat.black, -0.07 + i * 0.022, 0.006, -0.064, { cast: false, noEdge: true }); }
});
G(X0 + 0.24, 0, Z1 - 0.2, () => { // a takeaway bag in the corner by the door
  box(0.3, 0.36, 0.14, mat.paper, 0, 0.18, 0);
  for (const s of [-1, 1]) tube([[-0.07, 0.36, s * 0.06], [-0.05, 0.46, s * 0.055], [0.05, 0.46, s * 0.055], [0.07, 0.36, s * 0.06]], 0.003, mat.paper);
}, { ry: 0.12, float: 0.3 });
// what collects inside a door: a mat, the outdoor shoes, an umbrella in the corner
box(0.6, 0.008, 0.38, M({ map: seatMap, bumpMap: seatMap, bumpScale: 1.5, color: 0x9a968c, roughness: 1 }), dx + 0.05, 0.004, Z1 - 0.28, { r: 0.003, cast: false });
function shoe(x, z, turn, upper) {
  G(x, 0, z, () => {
    slab(RR(0.098, 0.275, 0.045), 0.02, mat.pvc, 0, 0.002, 0, 0.003);
    lump(1, upper, 0, 0.05, 0.02, 31, [0.044, 0.04, 0.125]);
    lump(1, mat.pvc, 0, 0.034, -0.1, 32, [0.042, 0.026, 0.04]); // the toe cap
    lump(1, upper, 0, 0.072, 0.07, 33, [0.036, 0.03, 0.05]);    // the collar round the ankle
    box(0.03, 0.006, 0.09, mat.pvc, 0, 0.082, -0.01, { r: 0.002, rx: 0.35 });
    for (let i = 0; i < 4; i++) box(0.05, 0.003, 0.004, mat.sheet, 0, 0.078 - i * 0.006, -0.03 - i * 0.02, { rx: 0.35, ry: (i % 2 ? 1 : -1) * 0.25, cast: false });
  }, { ry: turn, float: 0.2 });
}
shoe(dx + 0.2, Z1 - 0.3, 0.12, M({ color: 0x3b4252, roughness: 0.9 }));
shoe(dx + 0.07, Z1 - 0.27, -0.1, M({ color: 0x3b4252, roughness: 0.9 }));
G(X1 - 0.12, 0, Z1 - 0.1, () => { // the umbrella, rolled, leaning
  cyl(0.004, 0.86, mat.metal, 0, 0.43, 0, { seg: 8 });
  lathe([[0.004, 0.12], [0.022, 0.2], [0.026, 0.5], [0.018, 0.72], [0.006, 0.76]], M({ color: 0x20304a, roughness: 0.8 }), 0, 0, 0);
  box(0.012, 0.03, 0.002, M({ color: 0x20304a, roughness: 0.8 }), 0.024, 0.5, 0, { cast: false });
  torus(0.022, 0.006, mat.black, 0.022, 0.86, 0, { arc: Math.PI });
  cyl(0.006, 0.02, mat.alu, 0, 0.01, 0, { rTop: 0.003 });
}).rotation.set(0.1, 0, 0.16);

// ================= folding meal table =================
G(X0 + 0.55, 0, 0.95, () => {
  for (let i = 0; i < 5; i++) box(0.096, 0.02, 0.5, mat.pine, -0.2 + i * 0.1, 0.6, 0, { r: 0.004 }); // slatted top
  for (const sz of [-1, 1]) {
    box(0.03, 0.74, 0.02, mat.pine, 0, 0.3, sz * 0.2, { rz: 0.62 });
    box(0.03, 0.74, 0.02, mat.pine, 0, 0.3, sz * 0.215, { rz: -0.62 });
    cyl(0.005, 0.04, mat.alu, 0, 0.3, sz * 0.208, { rx: Math.PI / 2 });
  }
  for (const s of [-1, 1]) box(0.02, 0.02, 0.44, mat.pine, s * 0.2, 0.58, 0);
}, { float: 0.25 });

// ================= what lies on the desk =================
const DX = DESK.x, DZ = DESK.z;
const OBJ = {};
// the coffee mug, and drinking from it (author 2026-11-16: sip, a big mouthful, glug glug, refill)
const COFFEE = { level: 1, hot: 1, act: null, inner: null, liquid: null, steam: [], pour: null };
G(DX - 0.44, top, DZ - 0.02, () => {
  COFFEE.inner = G(0, 0, 0, () => {
    lathe([[0, 0], [0.034, 0], [0.04, 0.008], [0.042, 0.09], [0.039, 0.09], [0.037, 0.012], [0, 0.01]], mat.ceramic, 0, 0, 0);
    cyl(0.0362, 0.0005, M({ color: 0x3a2112, roughness: 0.6 }), 0, 0.0106, 0, { cast: false, noEdge: true, seg: 40 }); // what is left in the bottom
    COFFEE.liquid = cyl(0.0372, 0.002, mat.coffee, 0, 0.078, 0, { cast: false, noEdge: true, seg: 40 });
    torus(0.024, 0.006, mat.ceramic, 0.048, 0.047, 0, { arc: Math.PI, rz: -Math.PI / 2 });
  });
  for (let i = 0; i < 5; i++) COFFEE.steam.push(ball(0.012, M({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, roughness: 1 }, 3), 0, 0.1, 0, { cast: false }));
  COFFEE.pour = cyl(0.0035, 0.32, mat.coffee, 0, 0.25, 0, { cast: false, noEdge: true });
  COFFEE.pour.visible = false;
}, { ry: -0.5, float: 0.18 });
// its sounds are made on the spot, like the game's other sounds
let AUDIO = null;
const ac = () => (AUDIO ??= new (window.AudioContext || window.webkitAudioContext)());
function hiss(dur, f0, f1, gain, when = 0, type = "bandpass") { // a breath of filtered noise: a slurp rises, an "ahh" falls
  const c = ac(), n = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), t = c.currentTime + when;
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = b; f.type = type; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}
function gulp(when = 0) { // one swallow: a short note that drops
  const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
  o.type = "sine"; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(82, t + 0.13);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.2);
}
function click() { try { hiss(0.035, 2600, 900, 0.5, 0, "highpass"); } catch {} } // a rocker switch
function say(text, ms = 1600) { const cap = document.getElementById("caption"); cap.textContent = text; cap.style.opacity = "1"; clearTimeout(say.t); say.t = setTimeout(() => { cap.style.opacity = "0"; }, ms); }
const SIP = { sip: 0.07, gulp: 0.22, glug: 9 };
function drink(kind) {
  if (COFFEE.act) return;
  const t0 = performance.now() / 1000, from = COFFEE.level;
  try {
    if (kind === "refill") { COFFEE.act = { kind, t0, from, hold: 1.4 }; hiss(1.4, 500, 1400, 0.2, 0.05, "lowpass"); return; }
    if (from <= 0.02) { COFFEE.act = { kind: "empty", t0, from: 0, to: 0, hold: 0.5 }; say("空了。"); return; }
    const to = Math.max(0, from - SIP[kind]), hold = kind === "sip" ? 0.45 : kind === "gulp" ? 0.75 : 0.5 + from * 1.7;
    COFFEE.act = { kind, t0, from, to, hold };
    if (kind === "sip") hiss(0.32, 900, 2600, 0.16, 0.35);
    else if (kind === "gulp") { gulp(0.45); gulp(0.75); }
    else { const n = Math.max(2, Math.ceil(from * 6)); for (let i = 0; i < n; i++) gulp(0.42 + i * (hold - 0.2) / n); hiss(0.9, 1500, 500, 0.22, 0.75 + hold, "bandpass"); } // glug, glug, glug … ahh
  } catch {}
}
const _cv = new THREE.Vector3(), _cq0 = new THREE.Quaternion(), _cq1 = new THREE.Quaternion(), _ce = new THREE.Euler();
function updateCoffee(s, dt) {
  const a = COFFEE.act;
  let lift = 0, tilt = 0;
  if (a) {
    const t = s - a.t0;
    if (a.kind === "refill") {
      COFFEE.pour.visible = t < 1.3;
      COFFEE.level = Math.min(1, a.from + (1 - a.from) * ss(0.1, 1.3, t));
      if (t > 1.5) { COFFEE.hot = 1; COFFEE.act = null; }
    } else {
      const k = ss(0, 0.35, t) * (1 - ss(a.hold + 0.35, a.hold + 0.7, t));
      lift = k;
      COFFEE.level = a.from - (a.from - a.to) * ss(0, 1, (t - 0.35) / a.hold);
      tilt = k * (0.5 + (1 - COFFEE.level) * 0.8); // the emptier the mug, the further back it tips
      if (t > a.hold + 0.7) { COFFEE.act = null; if (a.kind === "glug") say("哈啊——", 1800); }
    }
  }
  const L = COFFEE.level;
  { // the mug comes to where a seated person holds it: middle of the view, a little below centre, close (author 2026-11-16)
    const par = COFFEE.inner.parent;
    par.updateWorldMatrix(true, false);
    _cv.set(0, -0.085, -0.36).applyMatrix4(camera.matrixWorld);
    par.worldToLocal(_cv);
    COFFEE.inner.position.set(0, 0, 0).lerp(_cv, lift);
    par.getWorldQuaternion(_cq0).invert();
    _cq1.setFromEuler(_ce.set(tilt, camera.rotation.y, 0, "YXZ")); // upright, turned to face her, tipped toward her mouth
    COFFEE.inner.quaternion.identity().slerp(_cq0.multiply(_cq1), Math.min(1, lift * 1.4));
  }
  COFFEE.liquid.visible = L > 0.02;
  COFFEE.liquid.position.y = 0.012 + L * 0.066;
  COFFEE.liquid.scale.set((0.0348 + L * 0.0028) / 0.0372, 1, (0.0348 + L * 0.0028) / 0.0372 * (1 + tilt * 0.25));
  COFFEE.liquid.rotation.x = -tilt * 0.85; // the coffee stays level while the mug does not
  COFFEE.hot = Math.max(0, COFFEE.hot - dt / 45);
  COFFEE.steam.forEach((m, i) => { const ph = (s * 0.22 + i / 5) % 1; m.position.set(Math.sin(s * 0.9 + i * 2) * 0.012 * ph, 0.092 + ph * 0.13 + lift * 0.2, Math.cos(s * 0.7 + i) * 0.01 * ph + lift * 0.14); m.scale.setScalar(0.5 + ph * 1.3); m.material.opacity = L > 0.05 ? 0.13 * COFFEE.hot * Math.sin(ph * Math.PI) : 0; });
  for (const m of COFFEE.steam) m.visible = lift < 0.05;
  mat.coffee.color.copy(C(0x150a05).lerp(C(0x4a0508), smooth(0.5, 0.9, state.collapse))); // late on, it is not coffee-coloured any more
}

// the laptop, shut, where it always is; a pen left on it; a square of yellow paper with nothing legible on it
G(DX - 0.58, top, DZ + 0.2, () => {
  slab(RR(0.3, 0.205, 0.012), 0.0105, mat.alu, 0, 0.0012, 0, 0.0012);
  box(0.26, 0.004, 0.006, M({ color: 0x6f7276, roughness: 0.5, metalness: 0.6 }), 0, 0.0062, -0.1, { cast: false });
  for (let i = 0; i < 4; i++) box(0.0012, 0.003, 0.006 + (i === 0 ? 0.004 : 0), mat.blackGloss, -0.1512, 0.006, -0.06 + i * 0.016, { cast: false, noEdge: true }); // ports
  for (const [x, z] of [[-0.13, -0.085], [0.13, -0.085], [-0.13, 0.085], [0.13, 0.085]]) cyl(0.005, 0.0012, mat.rubber, x, 0.0006, z);
  cyl(0.0042, 0.14, mat.blackGloss, 0.05, 0.0175, 0.03, { rx: Math.PI / 2, rz: 0.6, seg: 12 });
  cyl(0.0043, 0.012, mat.alu, 0.05 + Math.sin(0.6) * 0.06, 0.0175, 0.03 + Math.cos(0.6) * 0.06, { rx: Math.PI / 2, rz: 0.6, seg: 12 });
}, { ry: -0.1, float: 0.12 });
G(DX + 0.5, top, DZ + 0.29, () => {
  const g = new THREE.PlaneGeometry(0.076, 0.076, 8, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.006 * Math.pow(Math.max(0, p.getY(i) / 0.076 + 0.5), 2.2)); // the unstuck edge lifts
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  place(new THREE.Mesh(g, M({ side: THREE.DoubleSide, roughness: 0.85, map: face(128, 128, "#f1dc6a", (c) => { const R = rng(4); c.strokeStyle = "rgba(40,40,60,.7)"; c.lineWidth = 2; for (let r = 0; r < 4; r++) { c.beginPath(); let x = 14; c.moveTo(x, 34 + r * 20); while (x < 96 - r * 14) { x += 4; c.lineTo(x, 34 + r * 20 + (R() - 0.5) * 7); } c.stroke(); } }) })), 0, 0.0004, 0, { noEdge: true, cast: false });
}, { ry: 0.25, float: 0.3 });

// ================= the old things =================
// 1. the chick: the same machine the game draws when you hold it (src/world/room/devices.ts + devices.css, chick-face v2):
// a solid yellow egg, a cream bezel, a 48 × 32 glass with four printed icons above it and four below, three round red keys A B C
OBJ.chick = G(DX - 0.33, top, DZ + 0.25, () => {
  const U1 = 0.046 / 300, egg = (R, H) => { const pts = []; for (let i = 0; i <= 30; i++) { const t = (i / 30) * Math.PI; pts.push([Math.sin(t) * (R + 0.0042 * Math.cos(t)), -Math.cos(t) * H]); } return pts; }; // one CSS pixel of the drawn device, in metres
  lathe(egg(0.0232, 0.0292), M({ color: 0xf5c22a, roughness: 0.22 }), 0, 0.0086, 0, { rx: -Math.PI / 2 }).scale.set(1, 1, 0.37);
  lathe(egg(0.0235, 0.0295), M({ color: 0xd9950f, roughness: 0.3 }), 0, 0.0086, 0, { rx: -Math.PI / 2 }).scale.set(1, 1, 0.035); // the seam where the two halves meet
  const bz0 = -28 * U1; // the bezel sits above the egg's middle
  slab(RR(200 * U1, 180 * U1, 60 * U1), 0.0012, M({ color: 0xf7f3e6, roughness: 0.45 }), 0, 0.0158, bz0, 0.0005);
  const frame = chickFrames.frames["idle-1"], C = 5;
  label(152 * U1, 104 * U1, face(48 * C + 16, 32 * C + 16, "#aeb89a", (g) => { // the glass: 48 × 32 cells from the content's idle frame
    g.fillStyle = "rgba(0,0,0,.06)"; for (let y = 0; y < 32; y++) for (let x = 0; x < 48; x++) g.fillRect(8 + x * C, 8 + y * C, C - 1, C - 1);
    g.fillStyle = "#2b3324"; frame.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") g.fillRect(8 + x * C, 8 + y * C, C - 1, C - 1); }));
    g.strokeStyle = "#8f9b78"; g.lineWidth = 6; g.strokeRect(3, 3, 48 * C + 10, 32 * C + 10);
  }), 0, 0.0177, bz0, { rough: 0.2 });
  const names = ["meal", "light", "play", "medicine", "toilet", "checkup", "training", "attention"], [ic, ig] = canvas(600, 540);
  ig.fillStyle = "rgba(154,90,0,.75)";
  names.forEach((n, i) => { const cx = (40 + (i % 4) * 40 + 24) * 3, cy = (i < 4 ? 22 : 160) * 3; chickFrames.icons[n].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") ig.fillRect(cx - 27 + x * 6, cy - 27 + y * 6, 6, 6); })); }); // printed on the bezel, 9 × 9 each
  box(200 * U1, 0.0002, 180 * U1, M({ map: tex(ic, false), transparent: true, depthWrite: false, roughness: 0.5 }, 3), 0, 0.0177, bz0, { cast: false, noEdge: true });
  for (const k of [-1, 0, 1]) { ball(20 * U1, M({ color: 0xe0395a, roughness: 0.3 }), k * 62 * U1, 0.0166, 90 * U1 - Math.abs(k) * 0.0006, { s: [1, 0.55, 1] }); cyl(21.5 * U1, 0.0012, M({ color: 0x9b1f39, roughness: 0.4 }), k * 62 * U1, 0.0158, 90 * U1 - Math.abs(k) * 0.0006, { cast: false, seg: 24 }); }
  legend(186 * U1, 16 * U1, 3, 1, ["A", "B", "C"], 0, 0.0153, 126 * U1, "#9a5a00", 0.34);
  cyl(0.0022, 0.004, M({ color: 0xd9950f, roughness: 0.3 }), 0, 0.0086, -0.0298, { rx: Math.PI / 2, seg: 10 });
  torus(0.0048, 0.0007, mat.alu, 0, 0.0086, -0.0352, { rx: Math.PI / 2 });
  for (let i = 0; i < 16; i++) { const a = i * 0.36; ball(0.0012, mat.alu, 0.006 + i * 0.0026, 0.0014, -0.038 - Math.sin(a) * 0.007, { cast: false }); }
}, { ry: 0.3, float: 0.3 });
// 2. the electronic dictionary: a silver clamshell, lettered keys, the lid up on a two-knuckle hinge, the screen saying learn
OBJ.dictionary = G(DX + 0.47, top, DZ + 0.13, () => {
  slab(RR(0.124, 0.088, 0.009), 0.0095, mat.silver, 0, 0.0012, 0.001, 0.0012);
  box(0.11, 0.0006, 0.066, M({ color: 0x9da0a4, roughness: 0.55, metalness: 0.4 }), 0, 0.0122, 0.005, { cast: false });
  keys(10, 5, 0.0105, 0.0122, 0.0088, 0.0026, 0.0096, mat.cream, 0, 0.0136, 0.005);
  legend(0.105, 0.061, 10, 5, [..."1234567890QWERTYUIOPASDFGHJKL", "↵", "⇧", ..."ZXCVBNM", ",", ".", "中", "英", " ", " ", " ", " ", "↑", "↓", "←", "→"], 0, 0.0151, 0.005, "#3a3a3a", 0.46);
  for (const x of [-0.036, 0.036]) cyl(0.0056, 0.034, mat.silver, x, 0.0118, -0.0445, { rz: Math.PI / 2, seg: 16 });
  cyl(0.0036, 0.04, M({ color: 0x8b8e92, roughness: 0.4, metalness: 0.7 }), 0, 0.0118, -0.0445, { rz: Math.PI / 2, seg: 12 });
  const lid = G(0, 0.0118, -0.0445, () => {
    box(0.124, 0.088, 0.0075, mat.silver, 0, 0.048, 0, { r: 0.0036 });
    box(0.108, 0.07, 0.0008, M({ color: 0x8b8e92, roughness: 0.5, metalness: 0.5 }), 0, 0.05, 0.004, { r: 0.0003, cast: false });
    box(0.094, 0.056, 0.0008, mat.blackGloss, 0, 0.051, 0.0046, { cast: false, noEdge: true });
    box(0.088, 0.05, 0.0006, lcdMat(lcdTex("learn", 176, 100, 4)), 0, 0.051, 0.0052, { cast: false, noEdge: true });
    for (const x of [-0.052, 0.052]) ball(0.0016, mat.rubber, x, 0.086, 0.004, { cast: false });
  });
  lid.rotation.x = -0.3;
  for (const [x, z] of [[-0.052, -0.035], [0.052, -0.035], [-0.052, 0.037], [0.052, 0.037]]) cyl(0.003, 0.001, mat.rubber, x, 0.0005, z);
}, { ry: -0.16, float: 0.28 });
// 3. the pager: black, a grille and two holes at the top, a narrow window, three keys down the side, a sprung clip at the foot
OBJ.pager = G(DX + 0.3, top, DZ + 0.27, () => {
  slab(RR(0.052, 0.08, 0.008), 0.014, mat.black, 0, 0.0016, 0, 0.0016);
  for (let i = 0; i < 5; i++) box(0.016, 0.0006, 0.0012, mat.rubber, -0.004, 0.0174, -0.034 + i * 0.0026, { cast: false, noEdge: true });
  for (const x of [0.012, 0.017]) cyl(0.0011, 0.0006, mat.rubber, x, 0.0174, -0.03, { cast: false, seg: 10 });
  slab(RR(0.04, 0.03, 0.003), 0.0006, mat.blackGloss, 0, 0.0172, -0.008, 0.0002);
  label(0.033, 0.0185, lcdTex("0.7734", 132, 74, 3), 0, 0.0182, -0.008);
  for (let i = 0; i < 3; i++) ball(0.0042, mat.rubber, 0.0262, 0.0095, 0.006 + i * 0.012, { s: [0.45, 1, 1], cast: false });
  box(0.012, 0.0005, 0.004, mat.silver, -0.012, 0.0174, 0.028, { cast: false, noEdge: true }); // a maker's plate, worn blank
  cyl(0.0022, 0.03, mat.alu, 0, 0.006, 0.0405, { rz: Math.PI / 2, seg: 10 });
  box(0.024, 0.0014, 0.03, mat.alu, 0, 0.003, 0.053, { r: 0.0006, rx: 0.22 });
  box(0.024, 0.006, 0.0014, mat.alu, 0, 0.002, 0.0672, { rx: -0.5 });
}, { ry: 0.2, float: 0.26 });
// 4. the cassette player: a grey box, the tape seen through its door, a row of keys along the edge, earphones trailing
OBJ.tape = G(DX + 0.47, top, DZ - 0.07, () => {
  const body = M({ color: 0xd4d3cd, roughness: 0.5 }), door = M({ color: 0xc4c3bd, roughness: 0.45 });
  slab(RR(0.09, 0.118, 0.007), 0.026, body, 0, 0.002, 0, 0.002);
  slab(RR(0.074, 0.056, 0.004), 0.0003, door, 0, 0.0302, 0.008, 0.0001);
  box(0.06, 0.0004, 0.038, M({ color: 0xe9e6dc, roughness: 0.7 }), 0, 0.0309, 0.008, { cast: false, noEdge: true }); // the cassette under the window
  box(0.052, 0.0005, 0.009, M({ color: 0xf4f0e2, roughness: 0.8 }), 0, 0.0312, -0.004, { cast: false, noEdge: true });
  for (const [k, r] of [[-1, 0.0125], [1, 0.0085]]) { // more tape wound on one side than the other
    cyl(r, 0.0006, M({ color: 0x2a1c14, roughness: 0.35 }), k * 0.0168, 0.0313, 0.0125, { cast: false, seg: 28 });
    cyl(0.0056, 0.0008, mat.pvc, k * 0.0168, 0.0316, 0.0125, { cast: false, seg: 20 });
    for (let t = 0; t < 6; t++) box(0.0012, 0.001, 0.0026, mat.pvc, k * 0.0168 + Math.cos(t * 1.047) * 0.0036, 0.0319, 0.0125 + Math.sin(t * 1.047) * 0.0036, { ry: -t * 1.047 + Math.PI / 2, cast: false, noEdge: true });
  }
  slab(RR(0.062, 0.04, 0.003), 0.0006, M({ color: 0x20262a, roughness: 0.04, transparent: true, opacity: 0.28, depthWrite: false }, 3), 0, 0.0326, 0.008, 0.0002, { cast: false });
  for (let i = 0; i < 5; i++) box(0.0125, 0.007, 0.004, i === 4 ? mat.red : door, -0.03 + i * 0.015, 0.02, 0.0612, { r: 0.001 });
  cyl(0.009, 0.004, M({ color: 0x55585c, roughness: 0.5 }), 0.0462, 0.016, -0.03, { rz: Math.PI / 2, seg: 24 }); // the volume wheel
  cyl(0.0026, 0.004, mat.blackGloss, -0.0462, 0.016, 0.04, { rz: Math.PI / 2, seg: 10 });
  tube([[-0.048, 0.016, 0.04], [-0.07, 0.004, 0.07], [-0.14, 0.003, 0.08], [-0.2, 0.003, 0.14], [-0.17, 0.003, 0.21]], 0.0011, mat.cream);
  box(0.006, 0.004, 0.016, mat.cream, -0.17, 0.004, 0.21, { r: 0.0015, ry: 0.4 });
  for (const [x, z, rz] of [[-0.12, 0.26, 0.5], [-0.215, 0.235, -0.4]]) { tube([[-0.17, 0.003, 0.215], [(-0.17 + x) / 2 + 0.01, 0.003, (0.215 + z) / 2 + 0.01], [x, 0.006, z]], 0.0009, mat.cream, { seg: 14 }); ball(0.0072, mat.cream, x, 0.0066, z, { s: [1, 0.72, 1] }); cyl(0.0056, 0.002, M({ color: 0x8b8e92, roughness: 0.4, metalness: 0.7 }), x, 0.0118, z, { seg: 16 }); }
}, { ry: 0.12, float: 0.22 });
// 5. the phone card: thin plastic with rounded corners, a landscape in blue ink wash, a gold chip with its eight contacts
OBJ.iccard = G(DX + 0.08, top, DZ + 0.28, () => {
  const t = face(512, 320, "#eef2f3", (g, w, h) => {
    const R = rng(88);
    for (let k = 0; k < 5; k++) { // ranges, far to near: each a wash, darker and lower than the one behind
      const base = 120 + k * 36, amp = 86 - k * 12;
      g.fillStyle = `rgba(${86 - k * 8},${112 - k * 9},${140 - k * 8},${0.16 + k * 0.09})`;
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) g.lineTo(x, base - Math.abs(Math.sin(x / (46 + k * 17) + k * 1.9)) * amp * (0.5 + 0.5 * Math.sin(x / 150 + k)) + (R() - 0.5) * 3);
      g.lineTo(w, h); g.fill();
      { const m = g.createLinearGradient(0, base - 4, 0, base + 30); m.addColorStop(0, "rgba(238,242,243,0)"); m.addColorStop(0.5, "rgba(238,242,243,.5)"); m.addColorStop(1, "rgba(238,242,243,0)"); g.fillStyle = m; g.fillRect(0, base - 4, w, 34); } // mist lying in the valley
    }
    for (let i = 0; i < 90; i++) { const x = R() * w, y = 200 + R() * 100, s = 5 + R() * 9; g.strokeStyle = `rgba(40,64,92,${0.3 + R() * 0.4})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s); for (let b = 1; b < 4; b++) { g.moveTo(x - s * 0.3 * (1 - b / 4), y - s * b / 4); g.lineTo(x + s * 0.3 * (1 - b / 4), y - s * b / 4); } g.stroke(); } // pines
    g.fillStyle = "rgba(40,64,92,.55)"; for (let i = 0; i < 9; i++) g.fillRect(24 + i * 9, 292, 5, 9); // a serial number too small to read
  });
  slab(RR(0.0856, 0.054, 0.0034), 0.0005, mat.pvc, 0, 0.0002, 0, 0.0002);
  label(0.0846, 0.053, t, 0, 0.001, 0, { rough: 0.22 });
  label(0.0122, 0.0108, face(96, 84, "#d2aa48", (g) => { g.strokeStyle = "#8a6a1e"; g.lineWidth = 3; g.strokeRect(3, 3, 90, 78); g.beginPath(); g.moveTo(34, 3); g.lineTo(34, 81); g.moveTo(62, 3); g.lineTo(62, 81); for (const y of [22, 42, 62]) { g.moveTo(3, y); g.lineTo(34, y); g.moveTo(62, y); g.lineTo(93, y); } g.stroke(); }), 0.02, 0.0013, -0.011, { rough: 0.3 });
}, { ry: -0.3, float: 0.34 });
// 6. the folding calculator: a strip of solar cells in the lid, one line of digits, twenty-five keys, the first one red
OBJ.calculator = G(DX + 0.68, top, DZ + 0.2, () => {
  slab(RR(0.074, 0.104, 0.004), 0.005, mat.silver, 0, 0.0008, 0.053, 0.0008);
  slab(RR(0.058, 0.017, 0.002), 0.0006, mat.blackGloss, 0, 0.0066, 0.0115, 0.0002);
  label(0.052, 0.012, lcdTex("0.", 156, 36, 3), 0, 0.0076, 0.0115);
  keys(5, 5, 0.0128, 0.0146, 0.0106, 0.002, 0.0116, mat.cream, 0, 0.0074, 0.062);
  box(0.0106, 0.0021, 0.0116, mat.red, -0.0256, 0.00745, 0.0328, { r: 0.0008, cast: false });
  legend(0.064, 0.073, 5, 5, ["C", "±", "%", "√", "÷", "7", "8", "9", "×", "M+", "4", "5", "6", "−", "M−", "1", "2", "3", "+", "MR", "0", ".", "=", "+", "MC"], 0, 0.0087, 0.062, "#2a2a2a", 0.4);
  cyl(0.0032, 0.07, mat.silver, 0, 0.0034, 0, { rz: Math.PI / 2, seg: 12 });
  slab(RR(0.074, 0.104, 0.004), 0.003, mat.silver, 0, 0.0006, -0.053, 0.0006);
  box(0.062, 0.0004, 0.09, M({ color: 0x9da0a4, roughness: 0.5, metalness: 0.4 }), 0, 0.0044, -0.053, { cast: false });
  box(0.034, 0.0005, 0.011, M({ color: 0x1a1f3a, roughness: 0.15 }), 0.012, 0.0048, -0.014, { cast: false, noEdge: true });
  for (let i = 1; i < 4; i++) box(0.0004, 0.0006, 0.011, mat.silver, 0.012 - 0.017 + i * 0.0085, 0.0049, -0.014, { cast: false, noEdge: true });
}, { ry: -0.1, float: 0.24 });
// 7. the flip phone, shut: two shells and the line between them, a hinge, a small window, a strap with one red bead
OBJ.phone = G(DX - 0.66, top, DZ - 0.02, () => {
  const shell = M({ color: 0x2b2d31, roughness: 0.38, metalness: 0.35 });
  slab(RR(0.049, 0.094, 0.012), 0.0085, shell, 0, 0.0012, 0, 0.0012);
  slab(RR(0.049, 0.094, 0.012), 0.0085, shell, 0, 0.0118, 0, 0.0012);
  cyl(0.0088, 0.03, shell, 0, 0.0108, -0.047, { rz: Math.PI / 2, seg: 18 });
  for (const k of [-1, 1]) cyl(0.0088, 0.008, M({ color: 0x1b1c1f, roughness: 0.4, metalness: 0.4 }), k * 0.02, 0.0108, -0.047, { rz: Math.PI / 2, seg: 18 });
  slab(RR(0.03, 0.016, 0.003), 0.0005, mat.silver, 0, 0.0216, -0.026, 0.0002);
  slab(RR(0.026, 0.012, 0.002), 0.0005, mat.blackGloss, 0, 0.0222, -0.026, 0.0002);
  ball(0.0012, mat.ledRed, 0.014, 0.0222, -0.012, { cast: false });
  torus(0.004, 0.0006, mat.cream, 0.02, 0.008, 0.049, { rx: Math.PI / 2 });
  tube([[0.02, 0.008, 0.053], [0.03, 0.003, 0.07], [0.02, 0.002, 0.09], [0.035, 0.002, 0.105]], 0.0007, mat.cream, { seg: 16 });
  ball(0.0042, mat.red, 0.035, 0.0042, 0.105);
  for (let i = 0; i < 5; i++) cyl(0.0004, 0.014, mat.cream, 0.036 + (i - 2) * 0.0012, 0.0012, 0.116, { rx: Math.PI / 2, rz: (i - 2) * 0.12, seg: 4 });
}, { ry: 0.3, float: 0.2 });
// 8. the instant camera: a stepped cream body, a lens in three rings, a ribbed flash, a finder, a red release, the slot the picture comes out of
OBJ.camera = G(DX - 0.66, top, DZ - 0.22, () => {
  const ribs = (() => { const [c, g] = canvas(64, 8); for (let x = 0; x < 64; x++) { const v = 205 + Math.round(40 * Math.sin((x / 64) * Math.PI * 2 * 10)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 8); } return tex(c); })();
  box(0.134, 0.05, 0.096, mat.cream, 0, 0.025, 0, { r: 0.009 });
  box(0.134, 0.046, 0.066, mat.cream, 0, 0.068, -0.015, { r: 0.009 });
  box(0.134, 0.013, 0.022, mat.cream, 0, 0.0075, 0.056, { r: 0.005 }); // the lip under the slot
  box(0.106, 0.0042, 0.003, mat.blackGloss, 0, 0.0165, 0.0484, { cast: false, noEdge: true });
  cyl(0.035, 0.014, mat.black, -0.014, 0.058, 0.03, { rx: Math.PI / 2, seg: 36 });
  cyl(0.029, 0.03, mat.black, -0.014, 0.058, 0.05, { rx: Math.PI / 2, seg: 36 });
  torus(0.0292, 0.0012, mat.alu, -0.014, 0.058, 0.065);
  cyl(0.022, 0.004, M({ color: 0x1b1c1f, roughness: 0.3 }), -0.014, 0.058, 0.0645, { rx: Math.PI / 2, seg: 30 });
  ball(0.018, mat.lens, -0.014, 0.058, 0.0635, { s: [1, 1, 0.3] });
  ball(0.006, M({ color: 0x6f86a8, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.5 }, 3), -0.019, 0.063, 0.069, { s: [1, 1, 0.2], cast: false }); // the light in the glass
  box(0.038, 0.026, 0.005, M({ map: ribs, bumpMap: ribs, bumpScale: 1.5, roughness: 0.2 }), 0.042, 0.078, 0.0205, { r: 0.002 });
  box(0.042, 0.03, 0.004, mat.cream, 0.042, 0.078, 0.019, { r: 0.003 });
  box(0.022, 0.016, 0.005, mat.blackGloss, -0.046, 0.082, 0.0205, { r: 0.002 });
  cyl(0.0112, 0.004, mat.alu, 0.044, 0.04, 0.049, { rx: Math.PI / 2, seg: 24 });
  cyl(0.0094, 0.007, mat.red, 0.044, 0.04, 0.0505, { rx: Math.PI / 2, seg: 24 });
  for (const k of [-1, 1]) { cyl(0.004, 0.004, mat.alu, k * 0.068, 0.072, -0.01, { rz: Math.PI / 2, seg: 12 }); torus(0.005, 0.0008, mat.alu, k * 0.0715, 0.072, -0.01, { ry: Math.PI / 2 }); }
}, { ry: 0.4, float: 0.3 });

// ================= takeaway: the whole menu, and what the days do to it =================
const MTX = X0 + 0.55, MTZ = 0.95, MTY = 0.611;
const MEALS = {};
const kraftMap = (() => { // unbleached paper: warm, with short dark fibres
  const [c, g] = canvas(256, 256), R = rng(72);
  g.fillStyle = "#d2b185"; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 2600, 1.1, 0.1, 71);
  for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(95,62,25,${R() * 0.14})`; g.lineWidth = 0.6; g.beginPath(); const x = R() * 256, y = R() * 256, a = R() * 6.3; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
  return tex(c);
})();
const ridgeMap = (() => { const [c, g] = canvas(128, 8); for (let x = 0; x < 128; x++) { const v = 150 + Math.round(60 * Math.sin((x / 128) * Math.PI * 2 * 16)); g.fillStyle = `rgb(${v + 30},${v},${v - 40})`; g.fillRect(x, 0, 1, 8); } return tex(c); })();
const riceMap = (() => { const [c, g] = canvas(128, 128), R = rng(5); g.fillStyle = "#f3f0e6"; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < 0.5 ? "150,140,120" : "255,255,255"},${0.25 + R() * 0.3})`; g.beginPath(); g.ellipse(R() * 128, R() * 128, 3.2, 1.3, R() * 3.14, 0, 7); g.fill(); } return tex(c); })();
riceMap.repeat.set(3, 3);
const kraft = M({ map: kraftMap, bumpMap: kraftMap, bumpScale: 0.3, roughness: 0.85, side: THREE.DoubleSide });
const sleeveMat = M({ map: ridgeMap, bumpMap: ridgeMap, bumpScale: 2.5, roughness: 0.9, side: THREE.DoubleSide });
const clear = M({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }, 3);
const F = (color, roughness = 0.6, extra = {}) => M({ color, roughness, ...extra });
const wet = (color, opacity = 0.8) => M({ color, roughness: 0.05, transparent: true, opacity, depthWrite: false }, 3);
const food = {
  rice: M({ map: riceMap, bumpMap: riceMap, bumpScale: 1.2, roughness: 0.75 }), grain: F(0xf6f3ea, 0.6), chicken: F(0x7a431f, 0.22), sauce: F(0x4a2410, 0.1),
  potato: F(0xd9aa4f, 0.45), shiitake: F(0x3b2617, 0.5), pepper: F(0x4f7a35, 0.4), chili: F(0xb5281c, 0.35), dough: F(0xeae2cf, 0.4),
  wrap: M({ color: 0xf2ecdb, roughness: 0.3, transparent: true, opacity: 0.82 }), broth: wet(0xcdbd8c, 0.78), scallion: F(0x5fa046, 0.5), oil: wet(0xe2a23a, 0.55),
  redBroth: wet(0x9c1f14, 0.9), redOil: wet(0xd8501f, 0.6), noodle: F(0xdcab4c, 0.42), tofu: F(0xe8d5a6, 0.6), puff: F(0xc98f3c, 0.7), fishball: F(0xf4eee2, 0.4),
  crab: F(0xe8553a, 0.45), lotus: F(0xe9dfc9, 0.5), greens: F(0x3f7d38, 0.45), egg: F(0xf2e4c8, 0.35), konjac: F(0x77726a, 0.4), daikon: F(0xe9e2c6, 0.35), chikuwa: F(0xd8b27a, 0.5),
  nori: F(0x141d17, 0.55), soup: wet(0xb9a646, 0.85), ribbon: F(0xf0d461, 0.5), coffee: M({ color: 0x1d0c06, roughness: 0.06 }, 3), foam: F(0xe9dbc2, 0.75), crema: F(0xb98a58, 0.6),
  ice: M({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35 }, 3), stick: F(0xdcc592, 0.55), paperWhite: F(0xf4f3ee, 0.7), plastic: F(0xfafafa, 0.25),
  water: M({ color: 0xcfe6f2, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false }, 3), sesame: F(0xf1e6c4, 0.5), plum: F(0xa81f2a, 0.3), leaf: F(0x2f5d2c, 0.5),
};
function meal(id, build) { MEALS[id] = G(MTX, MTY, MTZ, build, { float: 0.22, ry: Math.PI / 2 + 0.2 }); MEALS[id].visible = false; } // local +z faces whoever stands at the table
/** A paper bowl: tapered wall with thickness, a rolled rim, a foot ring. */
function bowl(rt, rb, h, m = kraft, rim = true) {
  lathe([[0, 0.004], [rb - 0.004, 0.004], [rb - 0.002, 0], [rb, 0], [rt, h], [rt - 0.0025, h], [rb - 0.003, 0.007], [0, 0.007]], m, 0, 0, 0);
  if (rim) torus(rt, 0.0026, m, 0, h, 0, { rx: Math.PI / 2 });
}
function level(r, y, m) { cyl(r, 0.0015, m, 0, y, 0, { cast: false, noEdge: true, seg: 40 }); }
/** Chopsticks: square in section, tapering, never quite parallel. */
function sticks(x, y, z, turn, tilt = 0, len = 0.235) { for (const k of [-1, 1]) cyl(0.0019, len, food.stick, x + k * 0.005, y + (k > 0 ? 0.002 : 0), z + k * 0.004, { rTop: 0.0031, seg: 4, rz: Math.PI / 2 + tilt, ry: turn + k * 0.05 }); }
function heap(n, r, y, seed, each) { const R = rng(seed); for (let i = 0; i < n; i++) { const a = i * 2.39996 + R() * 0.8, d = Math.sqrt((i + 0.5) / n) * r; each(Math.cos(a) * d, y + R() * 0.006, Math.sin(a) * d, R, i); } }
/** Many small identical things in one draw call: rice grains, sesame, drops of oil, rings of scallion. */
function strew(n, geo, material, seed, fn) {
  const im = new THREE.InstancedMesh(geo, material, n), d = new THREE.Object3D(), R = rng(seed);
  for (let i = 0; i < n; i++) { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); fn(d, R, i); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
  im.receiveShadow = true;
  cur.add(im);
  return im;
}
const GEO = { grain: new THREE.SphereGeometry(0.0021, 6, 4), drop: new THREE.SphereGeometry(0.003, 10, 6), ring: new THREE.TorusGeometry(0.003, 0.0011, 5, 12), bit: new THREE.BoxGeometry(0.008, 0.0012, 0.005) };
const onSurface = (r, y, k = 1) => (d, R) => { const a = R() * 6.283, q = Math.sqrt(R()) * r; d.position.set(Math.cos(a) * q, y, Math.sin(a) * q); d.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.5, 0, R() * 6); d.scale.setScalar(k * (0.6 + R() * 0.8)); };
const oil = (n, r, y, m, seed) => strew(n, GEO.drop, m, seed, (d, R) => { const a = R() * 6.283, q = Math.sqrt(R()) * r; d.position.set(Math.cos(a) * q, y, Math.sin(a) * q); const k = 0.5 + R() * R() * 2.2; d.scale.set(k, 0.08, k); });
/** An irregular lump: a sphere pushed about by a few waves, so no two pieces of chicken match. */
function lump(r, material, x, y, z, seed, squash = [1, 0.75, 1], o = {}) {
  const g = new THREE.SphereGeometry(r, 16, 12), p = g.attributes.position, R = rng(seed), ph = [R() * 6, R() * 6, R() * 6];
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
    const k = 1 + 0.2 * Math.sin((X / r) * 2.3 + ph[0]) * Math.sin((Y / r) * 2.7 + ph[1]) + 0.11 * Math.sin((Z / r) * 4.1 + ph[2]);
    p.setXYZ(i, X * k * squash[0], Y * k * squash[1], Z * k * squash[2]);
  }
  g.computeVertexNormals();
  return place(new THREE.Mesh(g, material), x, y, z, { noEdge: true, ry: R() * 6, ...o });
}
/** A mound of rice: a body, then several hundred grains lying on it every which way. */
function riceMound(x, y, z, a, b, c, n = 520, seed = 3) {
  ball(1, food.rice, x, y, z, { s: [a, b, c] });
  strew(n, GEO.grain, food.grain, seed, (d, R) => {
    const th = Math.acos(R() * 0.95), ph = R() * 6.283;
    d.position.set(x + a * Math.sin(th) * Math.cos(ph), y + b * Math.cos(th), z + c * Math.sin(th) * Math.sin(ph));
    d.rotation.set(R() * 3, R() * 3, R() * 3);
    d.scale.set(1, 0.72, 2.5);
  });
}
/** A shallow paper tray whose walls lean out. */
function tray(w, d, h, m = kraft, lean = 0.16) {
  box(w - 0.01, 0.003, d - 0.01, m, 0, 0.0015, 0);
  for (const k of [-1, 1]) { box(w, h, 0.003, m, 0, h / 2, k * (d / 2 - 0.004), { rx: k * lean }); box(0.003, h, d, m, k * (w / 2 - 0.004), h / 2, 0, { rz: -k * lean }); }
}
function roundedTri(R, round = 0.3) {
  const sh = new THREE.Shape(), P = [0, 1, 2].map((i) => { const a = Math.PI / 2 + i * 2.0944; return [Math.cos(a) * R, Math.sin(a) * R]; });
  for (let i = 0; i < 3; i++) {
    const a = P[i], b = P[(i + 1) % 3], c = P[(i + 2) % 3];
    const m0 = [a[0] + (c[0] - a[0]) * round, a[1] + (c[1] - a[1]) * round], m1 = [a[0] + (b[0] - a[0]) * round, a[1] + (b[1] - a[1]) * round];
    if (i === 0) sh.moveTo(m0[0], m0[1]); else sh.lineTo(m0[0], m0[1]);
    sh.quadraticCurveTo(a[0], a[1], m1[0], m1[1]);
  }
  sh.closePath();
  return sh;
}
function slab(shape, depth, material, x, y, z, bevel = 0.004, o = {}) { // a flat shape given thickness, lying on the table
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);
  return place(new THREE.Mesh(g, material), x, y, z, { noEdge: true, ...o });
}
function receipt(x, z, turn, paper = "#f7f6f1") { // the till slip: a header, lines, a total, a torn bottom edge
  const t = face(96, 256, paper, (g) => { g.fillStyle = "#2b2b2b"; g.fillRect(20, 14, 56, 9); for (let i = 0; i < 12; i++) { g.fillRect(10, 40 + i * 13, 34 + ((i * 23) % 30), 3); g.fillRect(70, 40 + i * 13, 16, 3); } g.fillRect(10, 206, 76, 2); g.fillRect(52, 216, 34, 7); for (let x = 0; x < 96; x += 8) { g.fillStyle = "#c9c7c0"; g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 4, 249); g.lineTo(x + 8, 256); g.fill(); } });
  const g = new THREE.PlaneGeometry(0.048, 0.128, 2, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.004 * Math.sin((p.getY(i) / 0.128 + 0.5) * 3.3) + 0.0015); // it came off a roll and still curls
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  place(new THREE.Mesh(g, M({ map: t, roughness: 0.8, side: THREE.DoubleSide })), x, 0.0005, z, { ry: turn, noEdge: true, cast: false });
}
function napkin(x, z, turn) { for (let i = 0; i < 2; i++) box(0.11, 0.0012, 0.11, food.paperWhite, x + i * 0.004, 0.0008 + i * 0.0013, z + i * 0.003, { ry: turn + i * 0.07, cast: false }); }
function spoon(x, y, z, turn, tilt) { G(x, y, z, () => { ball(0.017, food.plastic, 0, 0, 0, { s: [1, 0.28, 1.45] }); box(0.011, 0.0022, 0.1, food.plastic, 0, 0.004, 0.066, { r: 0.001, rx: -0.08 }); }).rotation.set(tilt, turn, 0); }

meal("hmj", () => { // braised chicken on rice: a two-part paper box, lid standing open
  tray(0.19, 0.135, 0.038);
  box(0.0035, 0.033, 0.126, kraft, -0.012, 0.019, 0);
  const lid = G(0, 0.037, -0.068, () => { box(0.19, 0.003, 0.135, kraft, 0, 0, -0.0675); for (const k of [-1, 1]) box(0.003, 0.018, 0.118, kraft, k * 0.094, 0.009, -0.0675); box(0.172, 0.018, 0.003, kraft, 0, 0.009, -0.134); });
  lid.rotation.x = 1.2;
  riceMound(-0.057, 0.008, 0, 0.038, 0.026, 0.054);
  box(0.088, 0.012, 0.118, food.sauce, 0.04, 0.009, 0, { r: 0.005, cast: false, noEdge: true });
  heap(8, 0.036, 0.022, 5, (x, y, z, R, i) => lump(0.014 + R() * 0.005, food.chicken, 0.04 + x * 0.9, y, z * 1.25, 30 + i, [1, 0.72, 0.85 + R() * 0.3]));
  heap(4, 0.034, 0.026, 6, (x, y, z, R) => box(0.02, 0.016, 0.018, food.potato, 0.042 + x * 0.9, y, z * 1.3, { r: 0.005, ry: R() * 3, rx: R() }));
  heap(3, 0.03, 0.032, 7, (x, y, z, R) => ball(0.012, food.shiitake, 0.04 + x, y, z * 1.3, { s: [1, 0.45, 1], rx: R() - 0.5 }));
  heap(7, 0.036, 0.036, 9, (x, y, z, R, i) => box(0.024, 0.0025, 0.006, i % 3 ? food.pepper : food.chili, 0.04 + x * 0.85, y, z * 1.25, { ry: R() * 3, rz: (R() - 0.5) * 0.7, r: 0.001, cast: false }));
  oil(26, 0.036, 0.0158, food.oil, 12).position.set(0.04, 0, 0);
  sticks(0.0, 0.05, -0.012, 0.5, 0.06);
  box(0.21, 0.0012, 0.03, food.paperWhite, 0.0, 0.0008, 0.1, { ry: 0.08, cast: false }); // the chopsticks' paper sleeve, empty now
  box(0.05, 0.0004, 0.03, food.chili, -0.05, 0.0018, 0.104, { ry: 0.08, cast: false, noEdge: true });
  napkin(0.16, 0.04, 0.3);
});
meal("hmj_done", () => {
  tray(0.19, 0.135, 0.038);
  box(0.0035, 0.033, 0.126, kraft, -0.012, 0.019, 0);
  const lid = G(0, 0.037, -0.068, () => box(0.19, 0.003, 0.135, kraft, 0, 0, -0.0675)); lid.rotation.x = 0.45;
  box(0.08, 0.002, 0.11, food.sauce, 0.04, 0.004, 0, { r: 0.0009, cast: false, noEdge: true });
  strew(40, GEO.grain, food.grain, 4, (d, R) => { d.position.set(-0.09 + R() * 0.07, 0.0045, -0.05 + R() * 0.1); d.rotation.set(0, R() * 6, 0); d.scale.set(1, 0.7, 2.5); });
  lump(0.008, food.chicken, 0.06, 0.008, 0.03, 77, [1, 0.5, 0.6]); // the bone
  sticks(0.02, 0.03, 0.01, 1.1, 0.12);
  ball(0.03, food.paperWhite, 0.15, 0.02, 0.05, { s: [1.1, 0.6, 0.9] }); // the napkin, used
});
function wontons(n, r, y, seed) { heap(n, r, y, seed, (x, yy, z, R, i) => { lump(0.012, food.dough, x, yy + 0.003, z, seed * 10 + i, [1.05, 0.7, 0.9]); lump(0.021, food.wrap, x + (R() - 0.5) * 0.01, yy + 0.001, z + (R() - 0.5) * 0.01, seed * 20 + i, [1.15, 0.2, 0.85]); }); }
meal("wonton", () => { // 扁肉: thin skins trailing in clear broth
  bowl(0.08, 0.056, 0.064);
  wontons(11, 0.05, 0.046, 7);
  level(0.0745, 0.0505, food.broth);
  oil(60, 0.068, 0.0515, food.oil, 3);
  strew(34, GEO.ring, food.scallion, 8, onSurface(0.066, 0.0522));
  strew(9, GEO.bit, food.nori, 9, (d, R) => { onSurface(0.06, 0.052)(d, R); d.rotation.set(0, R() * 6, 0); d.scale.set(1.6, 1, 1.4); });
  spoon(0.03, 0.062, 0.02, -0.9, -0.5);
  receipt(-0.13, 0.05, 0.4);
});
meal("wonton_done", () => {
  bowl(0.08, 0.056, 0.064);
  level(0.06, 0.014, food.broth);
  strew(7, GEO.ring, food.scallion, 8, onSurface(0.05, 0.0155));
  spoon(0.012, 0.03, 0.0, -0.9, -0.62);
  receipt(-0.13, 0.05, 0.4);
});
function lotusSlice(x, y, z, o) { const t = face(64, 64, "#e9dfc9", (g) => { g.fillStyle = "#6e2a1c"; for (let i = 0; i < 7; i++) { const a = i * 0.898; g.beginPath(); g.arc(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17, 6, 0, 7); g.fill(); } g.beginPath(); g.arc(32, 32, 4, 0, 7); g.fill(); }); const m = cyl(0.019, 0.004, M({ map: t, roughness: 0.5 }), x, y, z, { seg: 20, ...o }); return m; }
meal("mlt", () => { // 麻辣烫: everything under a red surface
  bowl(0.084, 0.058, 0.068);
  heap(5, 0.05, 0.05, 11, (x, y, z, R, i) => box(0.024, 0.016, 0.02, food.puff, x, y, z, { ry: R() * 3, r: 0.006 }));
  heap(5, 0.055, 0.052, 12, (x, y, z, R, i) => ball(0.0125, food.fishball, x, y, z));
  heap(3, 0.045, 0.055, 13, (x, y, z, R) => lotusSlice(x, y, z, { rx: (R() - 0.5) * 0.8, rz: (R() - 0.5) * 0.8 }));
  heap(4, 0.05, 0.054, 14, (x, y, z, R) => { box(0.04, 0.008, 0.012, food.fishball, x, y, z, { ry: R() * 3, r: 0.003 }); });
  heap(4, 0.05, 0.057, 15, (x, y, z, R) => { const a = R() * 6; box(0.036, 0.004, 0.012, food.crab, x, y, z, { ry: a, r: 0.0018 }); });
  heap(5, 0.055, 0.056, 16, (x, y, z, R) => lump(0.022, food.greens, x, y, z, 160 + Math.floor(R() * 50), [1.3, 0.16, 0.6], { rz: (R() - 0.5) * 0.5 }));
  heap(6, 0.05, 0.055, 17, (x, y, z, R) => { const a = R() * 6.283; const t = tube([[x, y, z], [x + Math.cos(a) * 0.02, y + 0.008, z + Math.sin(a) * 0.02], [x + Math.cos(a + 1) * 0.035, y + 0.003, z + Math.sin(a + 1) * 0.035], [x + Math.cos(a + 2) * 0.02, y - 0.004, z + Math.sin(a + 2) * 0.02]], 0.004, food.fishball, { seg: 14 }); });
  level(0.078, 0.0535, food.redBroth);
  oil(110, 0.074, 0.0546, food.redOil, 5);
  strew(160, GEO.grain, food.sesame, 6, (d, R) => { onSurface(0.072, 0.0552)(d, R); d.rotation.set(0, R() * 6, 0); d.scale.set(0.6, 0.4, 1.1); });
  strew(14, GEO.bit, food.chili, 7, (d, R) => { onSurface(0.07, 0.0553)(d, R); d.rotation.set(0, R() * 6, 0); d.scale.set(0.8, 1, 0.7); });
  strew(16, GEO.ring, food.scallion, 8, onSurface(0.07, 0.0556));
  sticks(0.0, 0.074, 0.0, 0.25, 0.02);
  receipt(-0.135, 0.05, 0.35);
});
meal("mlt_done", () => { bowl(0.084, 0.058, 0.068); level(0.062, 0.015, food.redBroth); oil(30, 0.055, 0.016, food.redOil, 5); strew(30, GEO.grain, food.sesame, 6, (d, R) => { onSurface(0.055, 0.0166)(d, R); d.scale.set(0.6, 0.4, 1.1); }); sticks(0.0, 0.074, 0.0, 0.9, 0.02); });
meal("noodle", () => { // 拌面: every strand its own curve
  bowl(0.08, 0.056, 0.062);
  ball(0.064, food.noodle, 0, 0.026, 0, { s: [1, 0.4, 1] });
  const R = rng(21);
  for (let i = 0; i < 46; i++) {
    let a = R() * 6.283, r = 0.012 + R() * 0.04; const pts = [];
    for (let k = 0; k < 7; k++) { a += 0.5 + R() * 0.5; r = Math.min(0.058, Math.max(0.006, r + (R() - 0.5) * 0.02)); pts.push([Math.cos(a) * r, 0.045 + 0.012 * (1 - (r / 0.06) ** 2) + R() * 0.006, Math.sin(a) * r]); }
    tube(pts, 0.0019, food.noodle, { seg: 26 });
  }
  lump(0.022, F(0x7a4a22, 0.25), 0.005, 0.058, 0.0, 44, [1.2, 0.3, 1]); // the peanut sauce, not yet stirred in
  strew(26, GEO.ring, food.scallion, 22, (d, R2) => { onSurface(0.04, 0.064)(d, R2); });
  strew(60, GEO.grain, food.sesame, 23, (d, R2) => { onSurface(0.035, 0.066)(d, R2); d.scale.set(0.6, 0.4, 1.1); });
  sticks(0.0, 0.07, 0.0, 0.3, 0.03);
  receipt(-0.13, 0.05, 0.4);
});
meal("oden", () => { // 关东煮: four skewers standing in a tall cup
  bowl(0.047, 0.036, 0.098);
  level(0.0435, 0.074, food.broth);
  oil(18, 0.038, 0.075, food.oil, 3);
  const piece = { daikon: () => cyl(0.016, 0.014, food.daikon, 0, 0, 0, { seg: 20 }), ball: () => ball(0.0125, food.fishball, 0, 0, 0), tofu: () => { const m = cyl(0.017, 0.013, food.puff, 0, 0, 0, { seg: 3, rx: Math.PI / 2 }); }, chikuwa: () => { const m = cyl(0.01, 0.03, food.chikuwa, 0, 0, 0, { seg: 14, rz: Math.PI / 2 }); cyl(0.0045, 0.031, F(0x8a6a3a, 0.6), 0, 0, 0, { seg: 10, rz: Math.PI / 2 }); }, konjac: () => cyl(0.017, 0.012, food.konjac, 0, 0, 0, { seg: 3, rx: Math.PI / 2 }), egg: () => ball(0.014, F(0xb98652, 0.3), 0, 0, 0, { s: [0.85, 1.15, 0.85] }) };
  [["daikon", "ball", "ball"], ["tofu", "chikuwa", "ball"], ["konjac", "egg", "tofu"], ["chikuwa", "konjac", "daikon"]].forEach((ks, i) => {
    const a = i * 1.5708 + 0.5, sk = G(Math.cos(a) * 0.017, 0.012, Math.sin(a) * 0.017, () => {
      cyl(0.0016, 0.21, food.stick, 0, 0.105, 0, { seg: 6 });
      ks.forEach((kname, j) => G(0, 0.082 + j * 0.03, 0, piece[kname]));
    });
    sk.rotation.z = -Math.cos(a) * 0.2; sk.rotation.x = Math.sin(a) * 0.2;
  });
  box(0.014, 0.014, 0.004, F(0xd9b13a, 0.3), 0.07, 0.008, 0.03, { r: 0.002 }); // a sachet of mustard
});
meal("onigiri", () => { // 饭团: a rounded triangle of rice in a band of nori, still in its film
  slab(roundedTri(0.05, 0.32), 0.022, food.rice, 0, 0.006, 0, 0.006);
  box(0.045, 0.036, 0.03, food.nori, 0, 0.017, 0.012, { r: 0.004 });
  slab(roundedTri(0.058, 0.3), 0.03, clear, 0, 0.003, 0, 0.004, { cast: false });
  box(0.002, 0.001, 0.1, food.chili, 0, 0.0385, 0.002, { cast: false, noEdge: true }); // the tear strip, numbered 1-2-3 in life
  const t = face(128, 96, "#fbfaf6", (g) => { g.fillStyle = "#1f5c8c"; g.fillRect(8, 8, 112, 22); g.fillStyle = "#333"; for (let i = 0; i < 4; i++) g.fillRect(10, 40 + i * 11, 70 - i * 9, 4); g.fillStyle = "#c62828"; g.fillRect(88, 62, 30, 24); });
  label(0.04, 0.03, t, 0.002, 0.039, -0.012);
});
meal("phoenix", () => { // day 15: a rice ball in the shape of a phoenix; the shop does not sell this
  cyl(0.11, 0.0012, food.leaf, 0, 0.0008, 0, { seg: 5, cast: false }).scale.set(1.25, 1, 0.75); // a bamboo leaf under it
  lump(0.03, food.rice, 0.0, 0.02, 0, 150, [1.35, 0.62, 0.85]); // body
  strew(260, GEO.grain, food.grain, 15, (d, R) => { const th = Math.acos(R() * 0.9), ph = R() * 6.283; d.position.set(0.04 * Math.sin(th) * Math.cos(ph), 0.02 + 0.019 * Math.cos(th), 0.026 * Math.sin(th) * Math.sin(ph)); d.rotation.set(R() * 3, R() * 3, R() * 3); d.scale.set(1, 0.72, 2.5); });
  tube([[0.03, 0.026, 0], [0.05, 0.04, 0], [0.058, 0.062, 0], [0.066, 0.078, 0]], 0.0075, food.rice, { seg: 20 }); // the neck, lifted
  ball(0.011, food.rice, 0.07, 0.083, 0, { s: [1.2, 0.95, 0.9] });
  cyl(0.0001, 0.016, F(0xd9882a, 0.4), 0.088, 0.081, 0, { rTop: 0.0035, seg: 8, rz: Math.PI / 2 }); // beak
  for (const k of [-1, 1]) ball(0.0017, food.nori, 0.075, 0.086, k * 0.0085, { cast: false });
  for (let i = 0; i < 3; i++) { const f = G(0.064, 0.092, 0, () => lump(0.008, food.plum, -0.006, 0.006, 0, 300 + i, [1.6, 0.5, 0.35])); f.rotation.z = 0.5 + i * 0.45; f.rotation.y = (i - 1) * 0.3; } // crest
  for (const k of [-1, 1]) for (let i = 0; i < 5; i++) { // wings: five feathers a side, fanned
    const f = G(0.006 - i * 0.004, 0.028, k * 0.02, () => { lump(0.028, food.rice, 0, 0, k * 0.03, 200 + i, [0.34, 0.16, 1.15]); box(0.006, 0.0016, 0.012, food.nori, 0, 0.004, k * 0.058, { cast: false }); });
    f.rotation.y = k * (0.55 - i * 0.26); f.rotation.x = -k * (0.1 + i * 0.03);
  }
  for (let i = -2; i <= 2; i++) { // the tail: long streamers that curl at the end, each with an eye of plum
    const a = i * 0.24, len = 0.1 + (2 - Math.abs(i)) * 0.022, c = Math.cos(a), sn = Math.sin(a);
    const pts = [[-0.03, 0.02, 0], [-0.03 - len * 0.4 * c, 0.016, len * 0.4 * sn], [-0.03 - len * 0.8 * c, 0.01, len * 0.85 * sn], [-0.03 - len * c, 0.008, len * 1.05 * sn + (i >= 0 ? 0.012 : -0.012)], [-0.03 - len * 0.92 * c, 0.008, len * 1.1 * sn + (i >= 0 ? 0.026 : -0.026)]];
    const t = tube(pts, 0.006, food.rice, { seg: 30 }); t.scale.y = 0.45; t.position.y = 0.006;
    ball(0.0045, food.plum, pts[3][0], 0.014, pts[3][2], { s: [1, 0.4, 1] });
    ball(0.0075, food.nori, pts[3][0], 0.0125, pts[3][2], { s: [1, 0.25, 1], cast: false });
  }
});
meal("soup", () => { // 紫菜蛋花汤 in a clear tub, lid pressed on
  bowl(0.058, 0.045, 0.072, clear, false);
  cyl(0.0445, 0.052, food.soup, 0, 0.033, 0, { rTop: 0.0545, cast: false, noEdge: true, seg: 40 });
  const R = rng(31);
  for (let i = 0; i < 12; i++) { let a = R() * 6.283, r = R() * 0.04; const pts = []; for (let k = 0; k < 5; k++) { a += 0.6; r = Math.min(0.046, r + (R() - 0.3) * 0.012); pts.push([Math.cos(a) * r, 0.058 + R() * 0.002, Math.sin(a) * r]); } const t = tube(pts, 0.0028, food.ribbon, { seg: 16, cast: false }); t.scale.y = 1; }
  heap(12, 0.044, 0.059, 32, (x, y, z, R2) => lump(0.011, food.nori, x, 0.0595, z, 320 + Math.floor(R2() * 60), [1.3, 0.08, 0.8]));
  strew(18, GEO.ring, food.scallion, 33, onSurface(0.046, 0.0605));
  torus(0.0595, 0.003, clear, 0, 0.073, 0, { rx: Math.PI / 2, cast: false });
  cyl(0.0595, 0.002, clear, 0, 0.075, 0, { cast: false, noEdge: true, seg: 40 });
  cyl(0.03, 0.0015, clear, 0, 0.077, 0, { cast: false, noEdge: true, seg: 30 });
});
meal("steamed", () => { // 蒸饺: eight, each with its row of pleats
  tray(0.17, 0.118, 0.026);
  box(0.155, 0.0008, 0.104, food.paperWhite, 0, 0.0036, 0, { cast: false });
  for (let i = 0; i < 8; i++) {
    const x = -0.057 + (i % 4) * 0.038, z = i < 4 ? -0.026 : 0.026;
    const d = G(x, 0.004, z, () => {
      lump(0.02, food.wrap, 0, 0.011, 0, 400 + i, [0.72, 0.6, 1.2]);
      for (let k = 0; k < 8; k++) { const u = (k - 3.5) / 3.5; box(0.0045, 0.008, 0.0045, food.dough, 0.004 * (1 - u * u) - 0.002, 0.021 - 0.007 * u * u, u * 0.02, { r: 0.0015, rx: u * 0.5, ry: 0.5, cast: false }); } // the pleats
    });
    d.rotation.y = 0.2 + (i % 3) * 0.06;
  }
  G(0.11, 0, 0.03, () => { bowl(0.022, 0.016, 0.018, food.plastic, false); level(0.019, 0.013, wet(0x1c0d08, 0.95)); }); // the vinegar
  sticks(0.0, 0.034, 0.075, 0.05, 0.0);
});
meal("americano", () => { // iced, in a clear cup, a straw through the lid
  bowl(0.046, 0.033, 0.128, clear, false);
  cyl(0.0325, 0.105, food.coffee, 0, 0.056, 0, { rTop: 0.0435, cast: false, noEdge: true, seg: 40 });
  heap(8, 0.024, 0.086, 41, (x, y, z, R) => box(0.021, 0.021, 0.021, food.ice, x, y + R() * 0.012, z, { r: 0.004, ry: R() * 3, rx: R(), cast: false, noEdge: true }));
  torus(0.0465, 0.0028, clear, 0, 0.128, 0, { rx: Math.PI / 2, cast: false });
  cyl(0.047, 0.004, clear, 0, 0.131, 0, { cast: false, noEdge: true, seg: 40 });
  cyl(0.004, 0.2, F(0x1b1b1d, 0.4), 0.01, 0.12, 0.004, { rz: -0.12, rx: 0.06 });
  strew(70, GEO.drop, clear, 42, (d, R) => { const a = R() * 6.283, h = 0.02 + R() * 0.09, r = 0.0335 + (h / 0.128) * 0.013; d.position.set(Math.cos(a) * r, h, Math.sin(a) * r); d.scale.setScalar(0.25 + R() * 0.45); }); // it sweats
  box(0.09, 0.0006, 0.09, wet(0xbfd3dc, 0.25), 0, 0.0004, 0, { r: 0.0002, cast: false, noEdge: true }); // and leaves a ring of water
});
meal("latte", () => { // hot, a ribbed sleeve, the foam still drawn
  bowl(0.044, 0.031, 0.116, food.paperWhite);
  lathe([[0.0352, 0.03], [0.0402, 0.078], [0.0412, 0.078], [0.0362, 0.03]], sleeveMat, 0, 0, 0);
  const art = face(128, 128, "#b98a58", (g) => { g.strokeStyle = "#efe3cc"; g.lineCap = "round"; for (let i = 0; i < 6; i++) { g.lineWidth = 9 - i; g.beginPath(); g.ellipse(64, 40 + i * 12, 30 - i * 4, 9, 0, 0.15, Math.PI - 0.15); g.stroke(); } g.lineWidth = 4; g.beginPath(); g.moveTo(64, 22); g.lineTo(64, 112); g.stroke(); });
  cyl(0.041, 0.0015, M({ map: art, roughness: 0.7 }), 0, 0.109, 0, { cast: false, noEdge: true, seg: 40 });
});
meal("water", () => { // ribbed bottle, a paper label, a screw cap
  const prof = [[0, 0.003], [0.027, 0.003], [0.031, 0.01]];
  for (let i = 0; i <= 24; i++) { const y = 0.012 + (i / 24) * 0.118; prof.push([0.0315 - 0.0012 * Math.abs(Math.sin(i * 1.57)) * (y < 0.05 || y > 0.1 ? 1 : 0), y]); }
  prof.push([0.03, 0.14], [0.022, 0.162], [0.0135, 0.176], [0.0135, 0.19]);
  lathe(prof, clear, 0, 0, 0, { cast: false });
  cyl(0.0285, 0.15, food.water, 0, 0.08, 0, { cast: false, noEdge: true, seg: 30 });
  const lb = face(256, 64, "#f6f8fa", (g) => { g.fillStyle = "#1f6fb5"; g.fillRect(0, 0, 256, 16); g.fillRect(0, 54, 256, 10); g.fillStyle = "#1f6fb5"; g.beginPath(); g.ellipse(64, 35, 34, 10, 0, 0, 7); g.fill(); g.fillStyle = "#777"; for (let i = 0; i < 4; i++) g.fillRect(150, 24 + i * 7, 80 - i * 12, 2); });
  cyl(0.0322, 0.044, M({ map: lb, roughness: 0.6 }), 0, 0.075, 0, { cast: false, seg: 40 });
  cyl(0.0152, 0.015, food.plastic, 0, 0.197, 0, { seg: 24 });
  torus(0.0152, 0.0012, food.plastic, 0, 0.188, 0, { rx: Math.PI / 2 });
});
meal("battery", () => { // two LR44 cells on their card
  const card = face(192, 120, "#d9dde0", (g) => { g.fillStyle = "#b32a22"; g.fillRect(0, 0, 192, 26); g.fillStyle = "#333"; for (let i = 0; i < 3; i++) g.fillRect(12, 94 + i * 8, 120 - i * 30, 3); });
  box(0.078, 0.0012, 0.048, food.paperWhite, 0, 0.0006, 0);
  label(0.077, 0.047, card, 0, 0.0013, 0);
  for (const k of [-1, 1]) { cyl(0.0058, 0.0054, mat.alu, k * 0.016, 0.0042, 0.004, { seg: 28, cast: false }); cyl(0.0046, 0.0056, mat.silver, k * 0.016, 0.0042, 0.004, { seg: 28, cast: false }); ball(0.0105, clear, k * 0.016, 0.002, 0.004, { s: [1, 0.72, 1], cast: false }); }
});
meal("rice", () => { // day 4: a box of rice nobody ordered, lid on, steam beaded inside
  bowl(0.055, 0.045, 0.045, food.plastic, false);
  riceMound(0, 0.018, 0, 0.046, 0.022, 0.046, 300, 8);
  torus(0.056, 0.0025, clear, 0, 0.046, 0, { rx: Math.PI / 2, cast: false });
  cyl(0.056, 0.002, clear, 0, 0.049, 0, { cast: false, noEdge: true, seg: 40 });
  strew(60, GEO.drop, clear, 9, (d, R) => { const a = R() * 6.283, q = Math.sqrt(R()) * 0.05; d.position.set(Math.cos(a) * q, 0.0475, Math.sin(a) * q); d.scale.setScalar(0.2 + R() * 0.4); });
});
meal("notice", () => { // day 13 dinner: no food, a printed notice, folded in three
  const t = face(256, 360, "#f6f5f0", (g) => { g.fillStyle = "#222"; g.fillRect(28, 30, 130, 14); for (let i = 0; i < 11; i++) g.fillRect(28, 70 + i * 22, 200 - ((i * 37) % 70), 5); g.strokeStyle = "#b32a22"; g.lineWidth = 4; g.strokeRect(170, 300, 56, 36); g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(0, 119, 256, 2); g.fillRect(0, 239, 256, 2); });
  const g = new THREE.PlaneGeometry(0.15, 0.21, 2, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 0.21 + 0.5; p.setZ(i, 0.006 * Math.abs(Math.sin(v * Math.PI * 1.5)) + 0.0008); } // the folds will not lie flat
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  place(new THREE.Mesh(g, M({ map: t, roughness: 0.8, side: THREE.DoubleSide })), 0, 0, 0, { noEdge: true });
  paperBagFlat(0.17, 0.02, -0.5);
});
function paperBag(m = kraft) { // flat-bottomed bag: gusset creases down the sides, the top folded over twice, the slip stapled on
  box(0.2, 0.25, 0.11, m, 0, 0.125, 0);
  for (const k of [-1, 1]) box(0.0015, 0.24, 0.002, F(0x9c7a4c, 0.9), k * 0.1005, 0.125, 0, { cast: false, noEdge: true });
  box(0.2, 0.045, 0.018, m, 0, 0.268, 0.01, { rx: 0.55 });
  box(0.2, 0.03, 0.012, m, 0, 0.262, 0.03, { rx: 1.5 });
  const t = face(96, 128, "#f7f6f1", (g) => { g.fillStyle = "#2b2b2b"; g.fillRect(18, 10, 60, 8); for (let i = 0; i < 7; i++) g.fillRect(10, 30 + i * 12, 40 + ((i * 19) % 30), 3); });
  box(0.05, 0.066, 0.0008, M({ map: t, roughness: 0.8 }), 0.03, 0.19, 0.0556, { cast: false, noEdge: true, rz: 0.04 });
  box(0.008, 0.0015, 0.0012, mat.alu, 0.03, 0.218, 0.0562, { cast: false, noEdge: true });
}
function paperBagFlat(x, z, turn) { box(0.2, 0.004, 0.25, kraft, x, 0.002, z, { ry: turn }); }
meal("bag", () => paperBag());
// which of them a day brings, noon and evening (content/delivery.json, read by hand; the game would read the file)
const MENU = (day) => {
  if (day >= 18) return { lunch: [], dinner: [] };
  if (day === 17) return { lunch: ["bag"], dinner: ["bag"] }; // the bag of things sent back
  if (day === 16) return { lunch: [], dinner: [] };            // nothing comes any more
  return {
    lunch: day === 14 ? ["hmj", "soup"] : ["hmj"],
    dinner: day === 13 ? ["notice"] : day === 15 ? ["phoenix"] : day === 4 ? ["wonton", "rice"] : ["wonton"],
  };
};
const FOUND = { chick: 1, camera: 2, pager: 3, iccard: 4, tape: 5, dictionary: 6, calculator: 7, phone: 8 }; // content/stages.json objectsFoundOnDay
const DONE = { hmj: "hmj_done", wonton: "wonton_done", mlt: "mlt_done" };
function applyDay() {
  const day = state.day;
  for (const id in OBJ) OBJ[id].visible = day >= FOUND[id] || state.inspect === id;
  const pick = state.meal === "auto" ? MENU(day)[state.time < 17 ? "lunch" : "dinner"] : [state.meal];
  for (const id in MEALS) MEALS[id].visible = false;
  pick.forEach((id, i) => {
    const g = MEALS[state.eaten && DONE[id] ? DONE[id] : id];
    if (!g) return;
    g.visible = true;
    g.position.z = MTZ + (pick.length > 1 ? (i ? 0.13 : -0.1) : 0);
    g.position.x = MTX + (pick.length > 1 && i ? 0.06 : 0);
  });
  document.getElementById("dayV").textContent = `第 ${day} 天`;
  CARTON.traverse((o) => { if (o.userData.flap) o.visible = day > 1; if (o.userData.lid) o.visible = day === 1; });
  if (HAND.day !== day) buildHand(day);
  document.getElementById("handV").textContent = HAND.spec ? HAND.spec.name : "第 10 天起才来";
}
// what the room looks like on each day: photos' days stay clean here; the wall starts on 11, the material world is 15–18
function dayLook(day) {
  const c = { 10: 0.09, 11: 0.16, 12: 0.24, 13: 0.34, 14: 0.43, 15: 0.52, 16: 0.78, 17: 0.9, 18: 1 }[day] ?? 0;
  const px = { 16: 0.6, 17: 0.8, 18: 1 }[day] ?? 0; // slider units: full = PX_MAX of space broken (author: 20 % is the most it should ever be)
  const u = { 17: 0.62, 18: 0.95 }[day] ?? 0; // slider units: full = UN_MAX; lines and lifting only, no day rests in white
  return { collapse: c, pixel: px, unreal: u };
}

// ================= small things a room collects =================
G(X0 + 0.75, 0, Z0 + 0.25, () => { // waste bin
  lathe([[0.0, 0.004], [0.1, 0.004], [0.125, 0.27], [0.12, 0.27], [0.097, 0.012], [0, 0.012]], M({ color: 0x55585c, roughness: 0.5, side: THREE.DoubleSide }), 0, 0, 0);
  ball(0.05, mat.sheet, 0.02, 0.08, 0.01, { s: [1, 0.7, 1.1] });
  ball(0.04, mat.sheet, -0.04, 0.07, -0.03, { s: [1.1, 0.8, 0.9] });
}, { float: 0.25 });
// the jacket on its hook, left of the door as you face it
const jacketMap = fabricTexture("#6f7068", 61);
jacketMap.repeat.set(2, 3);
const jacketMat = M({ map: jacketMap, bumpMap: jacketMap, bumpScale: 1.2, roughness: 1 });
function drape(w, h, d, x, y, z, o = {}) {
  const g = new THREE.BoxGeometry(w, h, d, 36, 48, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), v = py / h + 0.5;
    const gather = ss(o.from ?? 0.5, 1, v); // the cloth is drawn in toward where it hangs from
    p.setX(i, px * (1 - (o.pinch ?? 0.7) * gather) + 0.012 * Math.sin(v * 6 + (o.ph ?? 0)));
    p.setZ(i, pz * (1 + 0.5 * gather) + (0.016 * Math.sin(px * 42 + v * 3 + (o.ph ?? 0)) + 0.007 * Math.sin(px * 95 + v * 8)) * (1 - gather * 0.4));
    p.setY(i, py + (v < 0.12 ? 0.014 * Math.sin(px * 24 + (o.ph ?? 0)) : 0) - 0.02 * gather * Math.abs(px) / w);
  }
  g.computeVertexNormals();
  return place(new THREE.Mesh(g, jacketMat), x, y, z, { noEdge: true, ...o });
}
G(0.42, 0, Z1, () => { // hung by the loop inside its collar: the shoulders fall away from the hook, the body hangs straight
  cyl(0.024, 0.012, mat.black, 0, 1.8, -0.006, { rx: Math.PI / 2 });
  tube([[0, 1.8, -0.01], [0, 1.8, -0.05], [0, 1.85, -0.075], [0, 1.93, -0.062]], 0.0065, mat.black);
  tube([[0, 1.79, -0.01], [0, 1.76, -0.04], [0, 1.775, -0.065]], 0.0065, mat.black);
  drape(0.5, 0.82, 0.075, 0, 1.36, -0.078, { from: 0.8, pinch: 0.62 });                       // the body
  ball(0.105, jacketMat, 0.0, 1.68, -0.1, { s: [1.25, 0.6, 0.55] });                          // the hood, collapsed on itself
  ball(0.07, jacketMat, 0.0, 1.745, -0.075, { s: [1.0, 0.7, 0.6] });
  drape(0.13, 0.7, 0.062, 0.225, 1.28, -0.105, { pinch: 0.3, from: 0.75, ph: 2, rz: 0.1 });   // sleeves, a little forward of the body
  drape(0.13, 0.68, 0.062, -0.23, 1.3, -0.1, { pinch: 0.3, from: 0.75, ph: 4, rz: -0.11 });
  for (const [x, y] of [[0.26, 0.95], [-0.265, 0.975]]) box(0.12, 0.05, 0.066, M({ color: 0x55564f, roughness: 1 }), x, y, -0.106, { r: 0.02 }); // cuffs
  box(0.006, 0.7, 0.004, M({ color: 0x2a2b28, roughness: 0.5, metalness: 0.5 }), 0.02, 1.33, -0.123, { cast: false }); // the zip
  box(0.012, 0.02, 0.005, mat.alu, 0.02, 1.0, -0.126, { cast: false });
  for (const k of [-1, 1]) box(0.11, 0.004, 0.004, M({ color: 0x4b4c46, roughness: 1 }), k * 0.13, 1.16, -0.124, { rz: k * 0.35, cast: false }); // pocket openings
  box(0.5, 0.045, 0.082, M({ color: 0x5c5d56, roughness: 1 }), 0, 0.965, -0.08, { r: 0.02 });   // the hem band
}, { float: 0.25 });

// ================= tentacles =================
// Each is a tube recomputed every frame from its centre line: how far it has grown, how it tapers to
// the tip, a slow wave down its length, a sway that is larger the further from its root.
const tentMat = M({ vertexColors: true, roughness: 0.36, side: THREE.DoubleSide }, 3);
// Suckers: one cup shape, instanced along the underside of every tentacle, two staggered rows (author 2026-11-16:
// black and smooth read wrong; they need skin, suckers, something of flesh).
const SUCK_MAX = 1400;
const SUCK = new THREE.InstancedMesh(new THREE.LatheGeometry([[0, 0.1], [0.3, 0.02], [0.62, 0.16], [0.86, 0.36], [1.0, 0.34], [1.06, 0.12], [0.94, -0.06]].map((p) => new THREE.Vector2(p[0], p[1])), 14), M({ color: 0xc98f86, roughness: 0.3 }, 3), SUCK_MAX);
SUCK.castShadow = false; SUCK.receiveShadow = true; SUCK.frustumCulled = false; SUCK.count = 0; SUCK.userData.noEdge = true;
const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sp = new THREE.Vector3(), _ss = new THREE.Vector3(), _sd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const tentacles = [];
const h2 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function tentacle(points, r, c0, sway = 0.06, outer = false) {
  const N = 150, RS = 16;
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const centres = curve.getSpacedPoints(N), fr = curve.computeFrenetFrames(N, false);
  const count = (N + 1) * (RS + 1);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= RS; j++) {
    const ang = (j / RS) * Math.PI * 2, under = Math.max(0, Math.sin(ang)), sucker = Math.pow(0.5 + 0.5 * Math.sin(i * 1.35), 6);
    const o = (i * (RS + 1) + j) * 3, mot = h2(i * 0.37, j * 0.9 + points.length), spot = h2(Math.floor(i / 3) * 1.7, Math.floor(j / 2) * 2.3) > 0.82 ? 1 : 0;
    // back: a dark, mottled hide, wine at the edges; belly: pale raw flesh, where the suckers sit
    const top = [0.4 + 0.14 * mot + 0.16 * spot, 0.07 + 0.04 * mot + 0.08 * spot, 0.13 + 0.06 * mot + 0.05 * spot], belly = [0.62 + 0.1 * mot, 0.3 + 0.08 * mot, 0.3 + 0.06 * mot];
    const kk = Math.pow(Math.min(1, Math.max(0, Math.sin(ang) + 0.45) / 1.2), 0.8) * (0.85 + 0.15 * sucker); // the belly comes well up the flanks
    col[o] = top[0] + (belly[0] - top[0]) * kk; col[o + 1] = top[1] + (belly[1] - top[1]) * kk; col[o + 2] = top[2] + (belly[2] - top[2]) * kk;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, tentMat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false;
  mesh.userData.noEdge = true;
  room.add(mesh);
  tentacles.push({ mesh, geo, centres, fr, r, c0, sway, ph: tentacles.length * 1.93, N, RS, outer });
}
const AC = [X0 + 0.75, 2.5, Z0 + 0.03];
tentacle([AC, [X0 + 0.8, 2.2, Z0 + 0.07], [X0 + 1.0, 1.75, Z0 + 0.06], [DESK.x - 0.5, 1.3, Z0 + 0.09], [DESK.x - 0.62, 0.95, Z0 + 0.2], [DESK.x - 0.45, 0.79, DESK.z + 0.05], [DESK.x - 0.2, 0.78, DESK.z + 0.22], [DESK.x + 0.02, 0.8, DESK.z + 0.3]], 0.034, 0.34, 0.03);
tentacle([AC, [X0 + 1.1, 2.56, Z0 + 0.06], [DESK.x + 0.3, 2.3, Z0 + 0.07], [0.6, 2.05, Z0 + 0.08], [1.1, 1.7, Z0 + 0.1], [1.25, 1.25, Z0 + 0.2], [1.2, 1.05, Z0 + 0.38]], 0.028, 0.5, 0.05);
tentacle([[BED.x - 0.2, 0.05, bz + 0.2], [BED.x - 0.6, 0.035, bz + 0.3], [0.3, 0.035, 0.3], [-0.1, 0.04, -0.2], [-0.3, 0.05, -0.55], [-0.42, 0.2, -0.75], [-0.5, 0.42, -0.82]], 0.04, 0.4, 0.05);
tentacle([[0.62, 0.1, Z0 + 0.45], [0.62, 0.4, Z0 + 0.47], [0.55, 0.5, Z0 + 0.62], [0.42, 0.3, Z0 + 0.75], [0.3, 0.04, Z0 + 0.95], [0.05, 0.035, Z0 + 1.2]], 0.03, 0.45, 0.06);
tentacle([[X1 - 0.03, ROOM.h - 0.03, Z0 + 0.03], [X1 - 0.12, 2.3, Z0 + 0.1], [X1 - 0.3, 1.8, Z0 + 0.12], [X1 - 0.45, 1.35, Z0 + 0.14], [X1 - 0.55, 1.05, Z0 + 0.2]], 0.045, 0.55, 0.07);
tentacle([[X0 + 0.02, 0.95, -0.3], [X0 + 0.18, 0.96, -0.32], [X0 + 0.3, 0.7, -0.4], [X0 + 0.36, 0.3, -0.6], [X0 + 0.6, 0.04, -0.75], [X0 + 0.95, 0.035, -0.9]], 0.03, 0.5, 0.05);
tentacle([[DESK.x - 0.02, 0.76, DESK.z - 0.3], [DESK.x - 0.02, 1.0, DESK.z - 0.27], [DESK.x - 0.02, 1.16, DESK.z - 0.12], [DESK.x + 0.03, 1.0, DESK.z + 0.05], [DESK.x + 0.1, 0.8, DESK.z + 0.14], [DESK.x + 0.26, 0.79, DESK.z + 0.2]], 0.022, 0.6, 0.03);
tentacle([[(DOOR.x0 + DOOR.x1) / 2, 0.02, Z1 + 0.05], [(DOOR.x0 + DOOR.x1) / 2 + 0.1, 0.03, Z1 - 0.3], [-0.6, 0.03, 1.3], [-0.2, 0.035, 1.0], [0.1, 0.04, 0.9]], 0.035, 0.5, 0.05);
tentacle([[X0 + 0.03, ROOM.h - 0.04, 1.2], [-0.9, ROOM.h - 0.06, 0.8], [-0.2, ROOM.h - 0.07, 0.2], [0.5, ROOM.h - 0.07, -0.4], [1.0, ROOM.h - 0.1, -0.9], [1.3, ROOM.h - 0.3, -1.3]], 0.06, 0.66, 0.04);
tentacle([[X1 - 0.03, ROOM.h - 0.04, 0.85], [X1 - 0.07, 2.1, 0.9], [X1 - 0.08, 1.3, 0.86], [X1 - 0.2, 0.7, 0.72], [BED.x, 0.58, bz + 0.5], [BED.x - 0.1, 0.6, bz + 0.1]], 0.036, 0.62, 0.05); // down the wall from the ceiling join, not through the narrow window's glass
function updateTentacles(s) {
  let sc = 0;
  if (!SUCK.parent) room.add(SUCK);
  for (const t of tentacles) {
    const grow = t.outer ? smooth(t.c0, t.c0 + 0.4, OUTER.k) : smooth(t.c0, t.c0 + 0.34, state.collapse);
    t.mesh.visible = grow > 0.01;
    if (!t.mesh.visible) continue;
    const P = t.geo.attributes.position.array, Nn = t.geo.attributes.normal.array, { N, RS } = t;
    for (let i = 0; i <= N; i++) {
      const tt = i / N, live = tt <= grow, k = live ? tt : grow, ci = Math.min(N, Math.round(k * N));
      const rad = live ? t.r * Math.pow(Math.max(0, 1 - k / grow), 0.55) * (1 + 0.09 * Math.sin(tt * 46 - s * 1.5 + t.ph) + 0.03 * Math.sin(i * 2.1)) : 0; // a slow swallow, and rings of skin
      const sw = k * k * t.sway * grow, c = t.centres[ci], n = t.fr.normals[ci], b = t.fr.binormals[ci];
      const cx = c.x + Math.sin(s * 0.6 + k * 5 + t.ph) * sw, cy = c.y + Math.cos(s * 0.45 + k * 4 + t.ph * 1.3) * sw * 0.5, cz = c.z + Math.sin(s * 0.5 + k * 6 + t.ph * 0.7) * sw;
      if (i % 3 === 1 && live && rad > 0.006 && sc < SUCK_MAX) { // a sucker on the belly, alternating sides
        const a = Math.PI / 2 + ((i / 3) % 2 < 1 ? 0.95 : -0.95), ca = Math.cos(a), sa = Math.sin(a);
        _sd.set(ca * n.x + sa * b.x, ca * n.y + sa * b.y, ca * n.z + sa * b.z);
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

// (the block opposite gets its sills, air-conditioners, poles of washing and roof clutter further down, once it exists)
// ================= the hand that comes for the day's work (nights 10–18) =================
// One hand, eight sets of numbers. Each night's god is the same construction with different counts:
// how many fingers, how many joints, how they taper, what they end in, what the skin is.
const HM = (o) => M({ side: THREE.DoubleSide, ...o }, 3);
/** Skin, as relief: pores, long faint wrinkles, and a cluster of creases across every joint (n joints along u). */
const SKIN = {};
function skinTex(n, deep = 1) {
  const key = n + ":" + deep;
  if (SKIN[key]) return SKIN[key];
  const [c, g] = canvas(512, 128), R = rng(40 + n);
  g.fillStyle = "#808080"; g.fillRect(0, 0, 512, 128);
  speckle(g, 512, 128, 5000, 0.9, 0.16, 41);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(0,0,0,${0.03 + R() * 0.06 * deep})`; g.lineWidth = 0.6; const y = R() * 128; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + (R() - 0.5) * 5); g.stroke(); }
  for (let j = 1; j <= n; j++) for (let k = 0; k < 6; k++) { // the creases over a knuckle
    const x = ((j - 0.5) / n) * 512 + (k - 2.5) * 5 + (R() - 0.5) * 3;
    g.strokeStyle = `rgba(0,0,0,${(0.16 + R() * 0.2) * deep})`; g.lineWidth = 0.8 + R() * 1.2;
    g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 128; y += 16) g.lineTo(x + Math.sin(y * 0.11 + k) * 2.2, y); g.stroke();
  }
  const t = tex(c); t.colorSpace = THREE.NoColorSpace;
  return (SKIN[key] = t);
} // the hand is not of the room: the room's rot and its broken pixels do not touch it
const marbleMap = (() => { const [c, g] = canvas(256, 256), R = rng(12); g.fillStyle = "#eeeae2"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) { g.strokeStyle = `rgba(120,118,125,${0.15 + R() * 0.3})`; g.lineWidth = 0.5 + R() * 1.5; g.beginPath(); let x = R() * 256, y = R() * 256, a = R() * 6; g.moveTo(x, y); for (let k = 0; k < 30; k++) { a += (R() - 0.5) * 0.8; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); } return tex(c); })();
const yellowCloth = fabricTexture("#b3952b", 81), gloveCloth = fabricTexture("#f3f1ea", 82);
const iridescent = patch(new THREE.MeshPhysicalMaterial({ color: 0x1c1c2a, roughness: 0.08, metalness: 0.2, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [120, 620], clearcoat: 1 }), 3);
const five = (k = 1, joints = 3, r = 0.0098) => [
  { x: -0.034, z: 0.045, len: 0.072 * k, joints, r, spread: -0.14 }, { x: -0.012, z: 0.05, len: 0.086 * k, joints, r: r * 1.04, spread: -0.04 },
  { x: 0.011, z: 0.049, len: 0.08 * k, joints, r, spread: 0.05 }, { x: 0.032, z: 0.043, len: 0.062 * k, joints, r: r * 0.88, spread: 0.17 },
  { x: -0.044, z: -0.012, len: 0.064 * k, joints: Math.max(2, joints - 1), r: r * 1.15, spread: -0.95, roll: 0.5 },
];
// Each night's visitor is its own kind of thing. Only some of them are hands at all.
const cloth = (map, extra = {}) => HM({ map, bumpMap: map, bumpScale: 1.2, roughness: 1, ...extra });
const shirtCloth = (() => { const [c, g] = canvas(128, 128); g.fillStyle = "#eef1f5"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#9db0c8"; for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 2, 128); speckle(g, 128, 128, 900, 1, 0.06, 5); const t = tex(c); t.repeat.set(4, 2); return t; })();
const darkBrass = HM({ color: 0x4d3f22, roughness: 0.35, metalness: 0.9 });
const GODS = {
  // 10. The King in Yellow: you never see the hand, only what the rags let out. The arm is cloth.
  10: { name: "黄衣之王", mode: "arm", fingers: five(1.7, 4, 0.005), palm: [0.066, 0.012, 0.09], wrist: 0.014, mat: HM({ color: 0xcfc6ae, roughness: 0.62, bumpMap: skinTex(4, 1.6), bumpScale: 3.5 }), armMat: cloth(yellowCloth), nail: "nail", nailMat: HM({ color: 0x6f6a4c, roughness: 0.3 }), nailLen: 2.8, knuckle: 1.3, taper: 0.9, curl: 0.16, speed: 0.4,    armThick: 3.4, tuck: -0.55, rags: 30 },
  // 11. Famine: it does not ask. It weighs. The scales are never level.
  11: { name: "饥荒", mode: "arm", palmDown: true, openMax: 0.22, lift: 0.05, fingers: five(1.2, 3, 0.0042), palm: [0.066, 0.008, 0.094], wrist: 0.009, mat: HM({ color: 0x1b1612, roughness: 0.7, bumpMap: skinTex(3, 1.8), bumpScale: 4 }), nail: "claw", nailMat: HM({ color: 0x2b261f, roughness: 0.3 }), knuckle: 1.9, taper: 0.92, curl: 0.3, speed: 0.2, bones: true,
    aux: () => {
      cyl(0.0012, 0.02, darkBrass, 0, -0.01, 0);
      const beam = G(0, -0.02, 0, () => { cyl(0.0022, 0.16, darkBrass, 0, 0, 0, { rz: Math.PI / 2, seg: 10 }); ball(0.005, darkBrass, 0, 0, 0); });
      const pans = [-1, 1].map((k) => { cur = beam; return G(k * 0.078, 0, 0, () => { for (let i = 0; i < 3; i++) { const a = i * 2.094; cyl(0.0006, 0.05, darkBrass, Math.cos(a) * 0.012, -0.024, Math.sin(a) * 0.012, { rz: -Math.cos(a) * 0.46, rx: Math.sin(a) * 0.46, seg: 5 }); } lathe([[0, -0.054], [0.024, -0.052], [0.03, -0.046], [0.031, -0.044]], M({ color: 0x4d3f22, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide }, 3), 0, 0, 0); }); });
      return (t) => { const a = 0.16 + 0.07 * Math.sin(t * 0.8); beam.rotation.z = a; for (const pn of pans) pn.rotation.z = -a; };
    } },
  // 12. Hypnos: a piece of a statue, broken at the forearm. Nothing brings it. It is lying there, palm down, asleep.
  12: { name: "修普诺斯", mode: "rest", fingers: five(1.05, 3, 0.0094), palm: [0.086, 0.026, 0.098], wrist: 0.027, mat: HM({ map: marbleMap, roughness: 0.14 }), nail: "nail", nailMat: HM({ map: marbleMap, roughness: 0.1 }), knuckle: 1.05, taper: 0.88, curl: 0.34, speed: 0.1, still: true,
    dress: (sp) => { const pl = sp.palm[2]; cyl(sp.wrist * 1.02, 0.1, sp.mat, 0, 0, -pl / 2 - 0.08, { rTop: sp.wrist * 1.25, rx: Math.PI / 2, seg: 24 }); lump(sp.wrist * 1.22, HM({ color: 0xd9d6cf, roughness: 0.95 }), 0, 0, -pl / 2 - 0.13, 12, [1, 1, 0.35]); } }, // the break: rough, unpolished
  // 13. Yog-Sothoth: not a hand. Globes come out of the gap in a stream and stand up as a ring. The gate, and the key.
  13: { name: "犹格·索托斯", mode: "stream", fingers: [], palmKind: "none", palm: [0.08, 0.03, 0.09], wrist: 0.02, mat: iridescent,
    dress: () => {
      const ring = G(0, 0.03, 0.04, () => { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ball(0.011 + 0.006 * Math.sin(i * 2.3), iridescent, Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0); } });
      const inner = G(0, 0.03, 0.04, () => { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ball(0.006, iridescent, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.01 * Math.sin(i)); } });
      HAND.spin = (t) => { ring.rotation.z = t * 0.35; inner.rotation.z = -t * 0.8; };
    } },
  // 14. Shub-Niggurath: every finger ends in a smaller hand, which also wants something. Hooves for nails.
  14: { name: "莎布·尼古拉斯", mode: "arm", fingers: five(1.0, 3, 0.011), palm: [0.094, 0.03, 0.1], wrist: 0.03, mat: HM({ color: 0x100d0c, roughness: 0.9, bumpMap: skinTex(3, 1.4), bumpScale: 3 }), nail: "hoof", nailMat: HM({ color: 0x2c251e, roughness: 0.25 }), knuckle: 1.15, taper: 0.9, curl: 0.2, speed: 0.7, tipHands: 0.3 },
  // 15. Nyarlathotep, the showman: a white glove with nobody in it. It presents.
  15: { name: "奈亚拉托提普（第一张脸）", mode: "float", fingers: five(1.0, 3, 0.0104), palm: [0.088, 0.027, 0.1], wrist: 0.027, mat: cloth(gloveCloth, { roughness: 0.95 }), nail: "none", knuckle: 1.02, taper: 0.9, curl: 0.06, speed: 0.5,
    dress: (sp) => {
      const pl = sp.palm[2], [, pt] = sp.palm;
      lathe([[sp.wrist * 1.12, 0], [sp.wrist * 1.5, -0.05], [sp.wrist * 1.56, -0.052], [sp.wrist * 1.2, 0]], sp.mat, 0, 0, -pl / 2 - 0.03, { rx: Math.PI / 2 });
      cyl(sp.wrist * 1.1, 0.001, HM({ color: 0x000000, roughness: 1 }), 0, 0, -pl / 2 - 0.045, { rx: Math.PI / 2, cast: false }); // look into the cuff: nothing
      for (const x of [-0.016, 0, 0.016]) box(0.0012, 0.0012, 0.05, HM({ color: 0xcfcbc0, roughness: 0.9 }), x, -pt / 2 - 0.0045, 0.008, { cast: false });
      ball(0.0045, HM({ color: 0x111111, roughness: 0.2 }), 0, pt / 2 + 0.004, -pl / 2 - 0.02, { s: [1, 0.5, 1] });
    } },
  // 16. Azathoth: no palm, no plan. A lump, and fingers out of it in every direction, each to its own count.
  16: { name: "阿撒托斯", mode: "arm", palmKind: "lump", fingers: Array.from({ length: 11 }, (_, i) => ({ x: Math.sin(i * 2.4) * 0.03, z: 0.01 + Math.cos(i * 1.7) * 0.03, len: 0.06 + ((i * 37) % 11) * 0.012, joints: 4 + ((i * 3) % 5), r: 0.008 + ((i * 5) % 3) * 0.0025, spread: -1.9 + i * 0.38, roll: (i % 2 ? 1 : -1) * (0.3 + ((i * 7) % 5) * 0.25) })), palm: [0.1, 0.07, 0.1], wrist: 0.036, mat: HM({ color: 0x8c3536, roughness: 0.2, bumpMap: skinTex(6, 1.2), bumpScale: 3 }), nail: "none", knuckle: 1.25, taper: 0.9, curl: 0.22, speed: 1.2, async: true, scale: 1.15 },
  // 17. Nyarlathotep again: somebody from the office. A shirt cuff, a watch. That is what is wrong with it.
  17: { name: "奈亚拉托提普（第二张脸）", mode: "arm", fingers: five(1.0, 3, 0.0102), palm: [0.084, 0.026, 0.098], wrist: 0.026, mat: HM({ color: 0xc79a7c, roughness: 0.5, bumpMap: skinTex(3, 1), bumpScale: 2.2 }), armMat: cloth(shirtCloth), nail: "nail", nailMat: HM({ color: 0xe6cdbf, roughness: 0.25 }), knuckle: 1.08, taper: 0.88, curl: 0.16, speed: 0.6, armThick: 1.5,
    dress: (sp) => {
      const pl = sp.palm[2], c = cloth(shirtCloth);
      lathe([[sp.wrist * 1.18, 0.012], [sp.wrist * 1.28, -0.05], [sp.wrist * 1.6, -0.12]], c, 0, 0, -pl / 2 - 0.02, { rx: Math.PI / 2 }).scale.set(1.1, 1, 0.82);
      ball(0.0035, HM({ color: 0xf2f2f2, roughness: 0.3 }), sp.wrist * 1.2, 0, -pl / 2 - 0.04, { s: [0.5, 1, 1] });
      box(sp.wrist * 2.3, sp.wrist * 1.75, 0.014, HM({ color: 0x1b1b1d, roughness: 0.6 }), 0, 0, -pl / 2 - 0.003, { r: 0.006 }); // the watch strap
      cyl(0.013, 0.006, HM({ color: 0xb9bcc0, roughness: 0.3, metalness: 0.8 }), 0, -sp.wrist * 0.9, -pl / 2 - 0.003, { seg: 28 });
      cyl(0.011, 0.0062, HM({ color: 0x0e1014, roughness: 0.1 }), 0, -sp.wrist * 0.9 - 0.0004, -pl / 2 - 0.003, { seg: 28 });
    } },
  // 18. Kuro: not a hand, never a hand. A few tentacles out of the gap; one comes further than the others.
  18: { name: "克总", mode: "tendrils", palmKind: "none", fingers: [
      { x: 0, z: 0, len: 0.56, joints: 11, r: 0.014, spread: 0.02 }, { x: -0.012, z: 0, len: 0.4, joints: 10, r: 0.011, spread: -0.42, roll: 0.5 },
      { x: 0.012, z: 0, len: 0.44, joints: 10, r: 0.012, spread: 0.38, roll: -0.4 }, { x: 0, z: 0, len: 0.3, joints: 9, r: 0.008, spread: -0.12, roll: 1.3 },
    ], palm: [0.086, 0.03, 0.1], wrist: 0.03, mat: HM({ color: 0x07070a, roughness: 0.12, bumpMap: skinTex(8, 0.6), bumpScale: 1.5 }), nail: "none", knuckle: 1.0, taper: 0.87, curl: 0.1, speed: 0.45, async: true },
};
const HAND = { root: new THREE.Group(), aux: new THREE.Group(), fingers: [], stream: [], spec: null, day: 0, spin: null, auxTick: null };
room.add(HAND.root, HAND.aux);
function gauss(x) { return Math.exp(-x * x); }
/** The palm as one surface: heel, the two pads, the hollow, knuckles and tendons on the back, narrowing into the wrist. */
function palmGeo(spec) {
  const [pw, pt, pl] = spec.palm, g = new THREE.SphereGeometry(1, 44, 30), k = spec.bones ? 2.6 : 1, xs = [-0.6, -0.2, 0.2, 0.6];
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let X = x * (pw / 2) * (1 + 0.1 * z), Y = y * (pt / 2 + 0.004) * (1 + 0.3 * ss(0.2, -0.9, z)), Z = z * (pl / 2);
    if (y > 0) Y += 0.007 * gauss((x + 0.55) / 0.42) * gauss((z + 0.45) / 0.5) + 0.004 * gauss((x - 0.6) / 0.4) * gauss((z + 0.55) / 0.45) - 0.0035 * gauss(x / 0.5) * gauss((z - 0.1) / 0.5) + 0.002 * gauss((z - 0.75) / 0.2);
    else for (const xi of xs) Y -= k * (0.0032 * gauss((x - xi) / 0.13) * gauss((z - 0.82) / 0.16) + 0.0013 * gauss((x - xi * (0.45 + 0.55 * (z + 1) / 2)) / 0.055) * ss(-0.9, -0.2, z) * ss(0.85, 0.5, z));
    const w = ss(-0.62, -1, z); // into the wrist
    if (w > 0) { const d = Math.hypot(x, y) || 1; X += (x / d * spec.wrist * 1.05 * Math.min(1, d * 3) - X) * w; Y += (y / d * spec.wrist * 0.86 * Math.min(1, d * 3) - Y) * w; Z -= w * 0.035; }
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals();
  return g;
}
const RINGS = 9, FRS = 14; // rings per joint, points round a finger
function addFinger(parent, spec, f, i, depth) {
  const [pw, , pl] = spec.palm, n = f.joints, w = Array.from({ length: n }, (_, j) => Math.pow(0.8, j)), sum = w.reduce((a, b) => a + b);
  const base = new THREE.Matrix4().makeRotationY(f.spread ?? 0).multiply(new THREE.Matrix4().makeRotationZ(f.roll ?? 0));
  base.setPosition(f.x * (pw / 0.086), 0, f.z * (pl / 0.1) - f.r * 1.6); // rooted inside the palm, so there is no join to see
  const F = { spec, n, Ls: w.map((v) => (f.len * v) / sum), r0: f.r, base, phase: spec.async ? i * 2.7 + depth * 1.1 : i * 0.55 + depth * 1.9, depth, M: RINGS * n, orbs: [] };
  if (spec.spheres) { // a finger of globes: many, of many sizes, none of them a joint
    const R = rng(60 + i);
    for (let k = 0; k < 6 + n * 3; k++) { const u = Math.pow(R(), 0.8), m = new THREE.Mesh(new THREE.SphereGeometry(f.r * (0.55 + R() * 1.1) * (1.15 - u * 0.6), 18, 12), spec.mat); m.castShadow = true; parent.add(m); F.orbs.push({ m, u, a: R() * 6.283, d: R() * f.r * 0.7 }); }
  } else {
    const count = (F.M + 1) * (FRS + 1), geo = new THREE.BufferGeometry(), uv = new Float32Array(count * 2), idx = [];
    for (let a = 0; a <= F.M; a++) for (let j = 0; j <= FRS; j++) { uv[(a * (FRS + 1) + j) * 2] = a / F.M; uv[(a * (FRS + 1) + j) * 2 + 1] = j / FRS; }
    for (let a = 0; a < F.M; a++) for (let j = 0; j < FRS; j++) { const q = a * (FRS + 1) + j, r = q + FRS + 1; idx.push(q, q + 1, r, r, q + 1, r + 1); }
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, spec.mat);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.noEdge = true;
    parent.add(mesh);
    F.geo = geo;
  }
  const tip = new THREE.Group(); tip.matrixAutoUpdate = false; parent.add(tip); F.tip = tip;
  const prev = cur; cur = tip;
  const r = f.r * Math.pow(spec.taper ?? 0.86, n * 0.5);
  if (spec.nail === "nail") { const L = r * 2.4 * (spec.nailLen ?? 1); box(r * 1.5, r * 0.22, L, spec.nailMat, 0, -r * 0.78, -r * 1.3 + L * 0.5, { r: r * 0.1 }); } // a plate bedded in the back of the tip
  else if (spec.nail === "claw") cyl(r * 0.8, r * 5.5, spec.nailMat, 0, -r * 0.35, r * 1.3, { rTop: 0.0003, rx: Math.PI / 2 - 0.3, seg: 12 });
  else if (spec.nail === "hoof") for (const k of [-1, 1]) box(r * 1.15, r * 2.1, r * 2.6, spec.nailMat, k * r * 0.62, 0, -r * 0.2, { r: r * 0.45 });
  cur = prev;
  HAND.fingers.push(F);
  if (spec.tipHands && depth === 0) { // each finger ends in a smaller hand, which also wants something
    const sub = new THREE.Group(); sub.scale.setScalar(spec.tipHands); sub.position.z = spec.palm[2] * spec.tipHands * 0.45;
    tip.add(sub);
    handBody(sub, { ...spec, tipHands: 0 }, depth + 1);
  }
}
const _c = new THREE.Vector3(), _t = new THREE.Vector3(), _x = new THREE.Vector3(), _n2 = new THREE.Vector3(), _m = new THREE.Matrix4();
function poseFinger(F, s, open) {
  const { spec, n, Ls, M } = F, per = 3 / n, sp = spec.still ? 0.15 : 1, pts = [new THREE.Vector3(0, 0, 0)];
  let phi = 0, y = 0, z = 0;
  for (let j = 0; j < n; j++) {
    const beckon = 0.24 * sp * Math.sin(s * spec.speed * 2 - F.phase + j * 0.45) + (spec.async ? 0.2 * Math.sin(s * (0.7 + F.phase * 0.31) + j) : 0);
    phi += ((1 - open) * 1.25 + spec.curl + Math.max(-0.1, beckon)) * (j === 0 ? 0.55 : 1) * per;
    const side = spec.mode === "tendrils" ? Math.sin(s * 0.6 + F.phase * 1.7 + j * 0.75) * 0.012 * j : 0; // a tentacle is not hinged: it wanders sideways as well
    pts.push(new THREE.Vector3(side, y + Math.sin(phi) * Ls[j] * 0.5, z + Math.cos(phi) * Ls[j] * 0.5)); // through the middle of each bone: the joint itself is rounded off
    y += Math.sin(phi) * Ls[j]; z += Math.cos(phi) * Ls[j];
  }
  pts.push(new THREE.Vector3(0, y, z));
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.applyMatrix4(F.base)), false, "centripetal");
  _x.setFromMatrixColumn(F.base, 0);
  const taper = spec.taper ?? 0.86, kn = (spec.knuckle ?? 1.1) - 1, cap = 1 - 0.55 / M * RINGS / n * 1.2;
  const rad = (u) => {
    let r = F.r0 * Math.pow(taper, u * n) * (1 + 0.28 * gauss(u / 0.12)); // thick where it leaves the palm
    for (let j = 1; j <= n; j++) r *= 1 + kn * 0.55 * gauss((u - (j - 0.5) / n) / (0.16 / n * 3)) * (j === 1 ? 0.6 : 1);
    if (u > cap) r *= Math.sqrt(Math.max(0, 1 - ((u - cap) / (1 - cap)) ** 2)); // the tip closes on itself
    return r;
  };
  let P, Nn;
  if (F.geo) { P = F.geo.attributes.position.array; Nn = F.geo.attributes.normal.array; }
  for (let a = 0; a <= M; a++) {
    const u = a / M;
    curve.getPoint(u, _c); curve.getTangent(u, _t);
    _n2.crossVectors(_t, _x).normalize();
    if (P) {
      const r = rad(u), dr = (rad(Math.min(1, u + 0.01)) - rad(Math.max(0, u - 0.01))) / 0.02 / (F.Ls.reduce((q, v) => q + v, 0));
      for (let j = 0; j <= FRS; j++) {
        const an = (j / FRS) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an) * 0.9, o = (a * (FRS + 1) + j) * 3; // a little flatter than round
        P[o] = _c.x + (_x.x * ca + _n2.x * sa) * r; P[o + 1] = _c.y + (_x.y * ca + _n2.y * sa) * r; P[o + 2] = _c.z + (_x.z * ca + _n2.z * sa) * r;
        const nx = _x.x * ca + _n2.x * sa - _t.x * dr, ny = _x.y * ca + _n2.y * sa - _t.y * dr, nz = _x.z * ca + _n2.z * sa - _t.z * dr, l = Math.hypot(nx, ny, nz) || 1;
        Nn[o] = nx / l; Nn[o + 1] = ny / l; Nn[o + 2] = nz / l;
      }
    }
    for (const ob of F.orbs) if (Math.abs(ob.u - u) <= 0.5 / M) ob.m.position.set(_c.x + (_x.x * Math.cos(ob.a) + _n2.x * Math.sin(ob.a)) * ob.d, _c.y + (_x.y * Math.cos(ob.a) + _n2.y * Math.sin(ob.a)) * ob.d + Math.sin(s * 0.8 + ob.a * 3) * 0.0015, _c.z + (_x.z * Math.cos(ob.a) + _n2.z * Math.sin(ob.a)) * ob.d);
  }
  if (P) { F.geo.attributes.position.needsUpdate = true; F.geo.attributes.normal.needsUpdate = true; }
  curve.getPoint(1, _c); curve.getTangent(1, _t); _n2.crossVectors(_t, _x).normalize();
  F.tip.matrix.makeBasis(_x, _n2, _t).setPosition(_c);
  F.tip.matrixWorldNeedsUpdate = true;
}
function handBody(parent, spec, depth) {
  const prev = cur;
  cur = parent;
  const [pw, pt, pl] = spec.palm;
  if (spec.palmKind === "lump") { lump(1, spec.mat, 0, 0, 0, 9, [pw / 2, pt / 2, pl / 2]); lump(1, spec.mat, 0.02, 0.012, -0.02, 19, [pw / 3, pt / 2.4, pl / 3]); }
  else if (spec.palmKind !== "none") place(new THREE.Mesh(palmGeo(spec), spec.mat), 0, 0, 0, { noEdge: true });
  for (const [i, f] of spec.fingers.entries()) addFinger(parent, spec, f, i, depth);
  if (depth === 0 && spec.dress) { cur = parent; spec.dress(spec); }
  cur = prev;
}
function buildHand(day) {
  HAND.root.clear(); HAND.aux.clear();
  HAND.fingers = []; HAND.stream = []; HAND.spin = null; HAND.auxTick = null;
  HAND.spec = GODS[day] ?? null;
  HAND.day = day;
  HAND.root.scale.setScalar(1);
  if (!HAND.spec) return;
  const spec = HAND.spec, inner = new THREE.Group();
  inner.scale.setScalar(spec.scale ?? 1);
  HAND.root.add(inner);
  handBody(inner, spec, 0);
  const prev = cur;
  cur = HAND.aux;
  if (spec.aux) HAND.auxTick = spec.aux();
  if (spec.mode === "stream") { const R = rng(13); for (let ci = 0; ci <= ARM.N; ci++) for (let k = 0; k < 2; k++) { const u = ci / ARM.N, m = ball((0.004 + R() * 0.011) * (0.5 + u), spec.mat, 0, 0, 0); HAND.stream.push({ m, ci, a: R() * 6.283, d: R() * 0.012 * (0.4 + u) }); } }
  if (spec.rags) { const R = rng(10), c = spec.armMat; for (let i = 0; i < spec.rags; i++) { const L = 0.03 + R() * 0.09, g = G(0, 0, 0, () => box(0.01 + R() * 0.014, L, 0.001, c, 0, -L / 2, 0)); HAND.stream.push({ m: g, ci: 8 + Math.floor(R() * (ARM.N - 8)), a: Math.PI * (0.15 + R() * 0.7), rag: true, ph: R() * 6 }); } }
  cur = prev;
  ARM.mesh.material = spec.armMat ?? spec.mat;
}
// the arm: a cord out of the gap between the two monitors, thickening into a wrist
const GAPX = DESK.x - 0.02;
const ARM = (() => {
  const N = 90, RS = 12, curve = new THREE.CatmullRomCurve3([[GAPX, top + 0.3, DZ - 0.24], [GAPX, top + 0.3, DZ - 0.1], [GAPX + 0.004, top + 0.285, DZ - 0.05], [GAPX + 0.01, top + 0.23, DZ + 0.0], [GAPX + 0.014, top + 0.16, DZ + 0.05], [GAPX + 0.016, top + 0.125, DZ + 0.1]].map((p) => new THREE.Vector3(...p)));
  const centres = curve.getSpacedPoints(N), fr = curve.computeFrenetFrames(N, false), count = (N + 1) * (RS + 1), idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const uv = new Float32Array(count * 2);
  for (let i = 0; i <= N; i++) for (let j = 0; j <= RS; j++) { uv[(i * (RS + 1) + j) * 2] = (i / N) * 3; uv[(i * (RS + 1) + j) * 2 + 1] = j / RS; }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat.black);
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.visible = false; mesh.userData.noEdge = true;
  room.add(mesh);
  return { N, RS, centres, fr, geo, mesh };
})();
const gapGlow = box(0.012, 0.31, 0.004, M({ color: 0x000000, emissive: 0xff5fa2, emissiveIntensity: 0 }, 3), GAPX, top + 0.31, DZ - 0.135, { cast: false, noEdge: true });
const gapLight = new THREE.PointLight(0xff5fa2, 0, 1.6, 2);
gapLight.position.set(GAPX, top + 0.3, DZ - 0.08);
scene.add(gapLight);
const _look = new THREE.Vector3();
// ---- handing the work over (author 2026-11-16: the player does it, by dragging it to the hand) ----
// The thing itself: a sheet of the screen's own light. It leaves the monitor, lands in the palm, and then the
// visitor answers by the verdict: perfect = closes on it and goes; flawed = turns it over to look, then goes;
// wrong = throws it back on the desk, where it stays.
const work = box(0.075, 0.0012, 0.052, M({ color: 0x0d1118, emissive: 0xbfd6ff, emissiveIntensity: 1.6, roughness: 0.3 }, 3), 0, 0, 0, { r: 0.0005, cast: false, noEdge: true });
work.visible = false;
const WORK_FROM = new THREE.Vector3(DESK.x - 0.3, top + 0.32, DESK.z - 0.11), WORK_REJECT = new THREE.Vector3(DESK.x - 0.14, top + 0.002, DESK.z + 0.27);
let give = null; // { verdict, t0 }
function giveAt(s) {
  if (!give) return null;
  const t = Math.max(0, s - give.t0), v = give.verdict, o = { t, fly: ss(0, 0.7, t), close: 0, roll: 0, back: 0, toss: 0 };
  if (v === "perfect") { o.close = ss(0.8, 1.4, t); o.back = ss(1.5, 3.0, t); o.end = 3.1; }
  else if (v === "flawed") { o.roll = ss(0.9, 1.7, t) * (1 - ss(3.0, 3.7, t)); o.close = ss(3.3, 3.9, t); o.back = ss(4.0, 5.6, t); o.end = 5.7; }
  else { o.toss = ss(0.95, 1.4, t); o.back = ss(1.8, 3.2, t); o.end = 3.3; }
  return o;
}
/** Where the palm is, in the world: the one stable point a dropped thing can aim for, whatever the visitor is. */
function palmWorld(out) {
  const spec = HAND.spec;
  if (!spec) return null;
  if (spec.mode === "tendrils" && HAND.fingers[0]) return out.setFromMatrixPosition(HAND.fingers[0].tip.matrixWorld); // the tentacle that comes furthest
  return HAND.root.localToWorld(out.set(0, spec.mode === "stream" ? 0.03 : spec.mode === "rest" ? -0.03 : spec.palmDown ? -0.035 : 0.022, spec.mode === "stream" ? 0.04 : 0));
}
/** The drop target for a drag: the palm projected onto the canvas, in CSS pixels of the canvas box. */
function handAnchor() {
  const p = palmWorld(new THREE.Vector3());
  if (!p || !HAND.root.visible) return null;
  const d = camera.position.distanceTo(p), r = canvasEl.getBoundingClientRect(), n = p.clone().project(camera);
  const half = (0.055 / (d * Math.tan((camera.fov * Math.PI) / 360))) * (r.height / 2); // a palm's half-width, as it looks from here
  return { x: (n.x * 0.5 + 0.5) * r.width - half, y: (-n.y * 0.5 + 0.5) * r.height - half, w: half * 2, h: half * 2 };
}
function updateHand(s) {
  const gv = giveAt(s), spec = HAND.spec, reach = state.hand * (gv ? 1 - gv.back : 1), on = !!spec && reach > 0.01, mode = spec?.mode ?? "arm";
  if (gv && gv.t > gv.end) { give = null; state.hand = 0; document.getElementById("hand").value = "0"; if (work.userData.kept !== true) work.visible = false; }
  ARM.mesh.visible = on && mode === "arm";
  HAND.root.visible = HAND.aux.visible = on;
  gapGlow.material.emissiveIntensity = spec ? ss(0, 0.15, reach) * 2.5 : 0;
  gapLight.intensity = spec ? ss(0, 0.3, reach) * 0.5 : 0;
  if (!on) return;
  const { N, RS, centres, fr } = ARM, tipI = Math.max(2, Math.round(reach * N)), wr = spec.wrist * (spec.scale ?? 1) * 1.15 * (spec.armThick ?? 1);
  if (mode === "arm") {
    const P = ARM.geo.attributes.position.array, Nn = ARM.geo.attributes.normal.array, thin = spec.armThick ? 0.012 : 0.004;
    for (let i = 0; i <= N; i++) {
      const ci = Math.min(i, tipI), u = ci / tipI, c = centres[ci], n = fr.normals[ci], b = fr.binormals[ci];
      const rad = i <= tipI ? thin + (wr - thin) * Math.pow(u, 2.2) * (1 + 0.04 * Math.sin(u * 30 - s * 2)) : 0; // a slow swallow travels down it
      for (let j = 0; j <= RS; j++) {
        const a = (j / RS) * Math.PI * 2, nx = Math.cos(a) * n.x + Math.sin(a) * b.x, ny = Math.cos(a) * n.y + Math.sin(a) * b.y, nz = Math.cos(a) * n.z + Math.sin(a) * b.z, o = (i * (RS + 1) + j) * 3;
        P[o] = c.x + nx * rad; P[o + 1] = c.y + ny * rad; P[o + 2] = c.z + nz * rad; Nn[o] = nx; Nn[o + 1] = ny; Nn[o + 2] = nz;
      }
    }
    ARM.geo.attributes.position.needsUpdate = true; ARM.geo.attributes.normal.needsUpdate = true;
  }
  const tip = centres[tipI], tan = centres[Math.min(N, tipI + 1)].clone().sub(centres[tipI - 1]).normalize();
  let open = ss(0.6, 1, gv ? state.hand : reach) * (spec.openMax ?? 1) * (gv ? 1 - gv.close : 1);
  HAND.root.scale.setScalar(1);
  if (mode === "tendrils") { // out of the gap itself; they lengthen as they come
    HAND.root.position.set(GAPX, top + 0.3, DZ - 0.11);
    HAND.root.lookAt(GAPX + 0.03, top + 0.02, DZ + 0.42);
    HAND.root.scale.setScalar(Math.max(0.001, ss(0, 1, reach)));
    open = 1;
  } else if (mode === "rest") { // it was not brought. It is there, a little further out each time you look
    const k = ss(0, 1, reach);
    HAND.root.position.set(GAPX + 0.03 * k, top + 0.027, DZ - 0.1 + 0.26 * k);
    HAND.root.lookAt(HAND.root.position.x + 0.2, top + 0.027, HAND.root.position.z + 1);
    HAND.root.rotateZ(Math.PI);
    open = 1;
  } else {
    const palmHalf = (spec.palm[2] / 2 + 0.02) * (spec.scale ?? 1);
    HAND.root.position.copy(tip).addScaledVector(tan, mode === "stream" ? 0.02 : palmHalf * (1 + (spec.tuck ?? 0)));
    HAND.root.position.y += spec.lift ?? 0;
    HAND.root.lookAt(_look.copy(HAND.root.position).add(tan));
    HAND.root.position.y += Math.sin(s * 0.7) * (mode === "float" ? 0.008 : 0.003);
    if (spec.palmDown) HAND.root.rotateZ(Math.PI);
    if (mode === "float") { HAND.root.rotateZ(0.5 * Math.sin(s * 0.6)); HAND.root.rotateX(-0.25 + 0.12 * Math.sin(s * 0.9)); } // the flourish
    if (mode === "stream") HAND.root.rotateX(0.35); // the ring stands, facing whoever sits at the desk
  }
  for (const g of HAND.stream) { // globes shouldering each other along the way out
    g.m.visible = g.ci <= tipI;
    if (!g.m.visible) continue;
    if (g.rag) { // a strip of the sleeve, hanging from wherever on the arm it is sewn
      const c0 = centres[g.ci], u = g.ci / tipI, rr = 0.012 + (wr - 0.012) * Math.pow(u, 2.2);
      g.m.position.set(c0.x + Math.cos(g.a) * rr, c0.y - Math.sin(g.a) * rr * 0.8, c0.z);
      g.m.rotation.set(0.12 * Math.sin(s * 0.9 + g.ph), g.ph, 0.1 * Math.sin(s * 0.7 + g.ph * 2));
      continue;
    }
    const c = centres[g.ci], n = fr.normals[g.ci], b = fr.binormals[g.ci], a = g.a + s * 0.5;
    g.m.position.set(c.x + (Math.cos(a) * n.x + Math.sin(a) * b.x) * g.d, c.y + (Math.cos(a) * n.y + Math.sin(a) * b.y) * g.d, c.z + (Math.cos(a) * n.z + Math.sin(a) * b.z) * g.d);
  }
  if (gv && gv.roll && mode !== "tendrils") HAND.root.rotateZ(gv.roll * Math.PI * 0.95); // turned over, to be looked at
  if (HAND.spin) HAND.spin(s);
  if (HAND.auxTick) { HAND.aux.position.copy(HAND.root.position); HAND.aux.position.y -= 0.012; HAND.auxTick(s); } else HAND.aux.position.set(0, 0, 0);
  HAND.root.updateMatrixWorld(true);
  for (const F of HAND.fingers) poseFinger(F, s, open);
  if (gv) { // the sheet: out of the screen in an arc, into the palm; then whatever the verdict does with it
    const palm = palmWorld(_c);
    work.visible = true; work.userData.kept = false;
    work.position.lerpVectors(WORK_FROM, palm, gv.fly); work.position.y += Math.sin(gv.fly * Math.PI) * 0.05;
    work.rotation.set(-1.2 * (1 - gv.fly), 0, 0);
    work.scale.setScalar(1 - 0.9 * ss(0.5, 1, gv.back));
    if (gv.toss) { work.position.lerpVectors(palm, WORK_REJECT, gv.toss); work.position.y += Math.sin(gv.toss * Math.PI) * 0.09; work.rotation.set((1 - gv.toss) * 5, gv.toss * 2.3, 0.4 * (1 - gv.toss)); work.scale.setScalar(1); work.userData.kept = true; }
    if (gv.roll) work.position.y += 0.02 * gv.roll;
  }
  const drop = document.getElementById("drop");
  if (drop) { const a = drop.dataset.on === "1" ? handAnchor() : null; drop.style.display = a ? "block" : "none"; if (a) Object.assign(drop.style, { left: a.x + "px", top: a.y + "px", width: a.w + "px", height: a.h + "px" }); }
}

// ================= outside the big window =================
const outside = new THREE.Group();
scene.add(outside);
const facades = [];
function block(x, z, w, h, d, seed, y0, floorsTimes = 1) {
  const [map, emissiveMap] = facadeTextures(seed);
  for (const t of [map, emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, floorsTimes); }
  const m = M({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.95 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), [m, m, M({ color: 0x77736b }), m, m, m]);
  mesh.position.set(x, y0 + h / 2, z);
  outside.add(mesh);
  facades.push(m);
}
// The block opposite is as tall as ours or taller: from a room partway up you look across at its wall, floor after floor,
// and never down onto its roof (author 2026-11-16: 不可能是奇怪的俯视…看不到对面房顶).
block(-25, -2.5, 18, 31, 8, 101, -12, 2);
block(-44, 14, 26, 44, 9, 202, -14, 2); // the ones behind are taller still: no roofs, no sky under them
block(-38, -24, 16, 40, 9, 303, -13, 2);
{
  const leaf = M({ color: 0x4f6a48, roughness: 1 }), R = rng(9);
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + R() * 0.8, 1), leaf);
    s.position.set(-9.5 + R() * 2.4, -1.4 + R() * 3.2, 1.6 + R() * 2.6);
    outside.add(s);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 7, 8), M({ color: 0x3c3128, roughness: 1 }));
  trunk.position.set(-8.4, -4, 2.8);
  outside.add(trunk);
}
{ // the nearest block, face on: x = -21 is its wall toward us, 18 m wide (z -11.5 … 6.5), from y -12 to 3.5; 9 × 7 windows as painted
  const fx = -21, cols = 9, rows = 14, W = 18, Hh = 31, z0 = -11.5, y0 = -12, cw = W / cols, rh = Hh / rows, R = rng(55);
  const conc = M({ color: 0xa9a294, roughness: 0.95 }), white = M({ color: 0xd9d6cc, roughness: 0.7 }), pole = M({ color: 0x8d8f92, roughness: 0.5, metalness: 0.6 });
  const dye = [0xb84a3e, 0x3d5f8f, 0xe6e2d6, 0x6b8f5a, 0xd7b35a, 0x2b2b30, 0xc97a9a].map((c) => M({ color: c, roughness: 0.95, side: THREE.DoubleSide }));
  const prev = cur; cur = outside;
  strew(cols * rows, new THREE.BoxGeometry(0.16, 0.06, cw * 0.62), conc, 1, (d, _R, i) => d.position.set(fx + 0.08, y0 + Hh - (Math.floor(i / cols) + 0.74) * rh, z0 + ((i % cols) + 0.5) * cw)); // sills
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const y = y0 + Hh - (r + 0.5) * rh, z = z0 + (k + 0.5) * cw, q = R();
    if (q < 0.34) { box(0.32, 0.5, 0.75, white, fx + 0.18, y - rh * 0.38, z + 0.2, { cast: false, noEdge: true }); box(0.02, 0.36, 0.5, M({ color: 0x55585c, roughness: 0.6 }), fx + 0.345, y - rh * 0.38, z + 0.2, { cast: false, noEdge: true }); } // an air-conditioner on its bracket
    else if (q < 0.62) { // a pole of washing
      const L = 1.4 + R() * 0.6;
      cyl(0.018, L, pole, fx + L / 2, y - rh * 0.1, z, { rz: Math.PI / 2, seg: 6 });
      for (let n = 0, x = 0.25; x < L - 0.1; n++) { const w = 0.3 + R() * 0.35, h = 0.5 + R() * 0.5; box(0.01, h, w, dye[Math.floor(R() * dye.length)], fx + x, y - rh * 0.1 - h / 2, z + (R() - 0.5) * 0.1, { ry: Math.PI / 2 + (R() - 0.5) * 0.3, cast: false, noEdge: true }); x += 0.14 + R() * 0.2; }
    }
    if (R() < 0.18) box(0.5, 0.9, cw * 0.6, M({ color: 0x8b8f93, roughness: 0.5, metalness: 0.5 }), fx + 0.25, y - rh * 0.05, z, { cast: false, noEdge: true }).material.wireframe = true; // a cage of anti-theft bars
  }
  // the roof: a water tank, a stair head, aerials, a parapet
  box(0.3, 0.7, W, conc, fx + 0.15, y0 + Hh + 0.35, z0 + W / 2, { noEdge: true });
  cyl(0.9, 1.6, M({ color: 0x9fa3a6, roughness: 0.5, metalness: 0.5 }), fx - 2.5, y0 + Hh + 1.4, z0 + 4, { seg: 16 });
  box(3, 2.4, 3.5, conc, fx - 3, y0 + Hh + 1.2, z0 + 12, { noEdge: true });
  for (let i = 0; i < 5; i++) { const z = z0 + 1 + R() * (W - 2); cyl(0.02, 2.5 + R() * 2, pole, fx - 1 - R() * 3, y0 + Hh + 1.6, z, { seg: 5 }); }
  cur = prev;
}
const RAIN_N = 900;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6), rainSeed = [];
{
  const R = rng(404);
  for (let i = 0; i < RAIN_N; i++) rainSeed.push({ x: -2.3 - R() * 9, z: -6 + R() * 10, y: R() * 9, v: 7 + R() * 4 });
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.32 }));
rain.visible = false;
rain.frustumCulled = false;
scene.add(rain);

// ================= what is outside on the last day (author 2026-11-16) =================
// Something too large to see whole goes past the window: only its skin, sliding. Tentacles come up against the
// glass. Then an eye rises into the frame, finds whoever is in the room, holds, and moves on. A loop of about half a minute.
// The far view is a picture, not geometry (author 2026-11-16: 窗外远处的背景用真图，然后主要还是做各种变异). The built blocks
// and the ball tree are kept but switched off; what is modelled out there from now on is only what goes wrong.
const CITY = [...outside.children];
for (const o of CITY) o.visible = false;
const VIEW = [];
{
  // The block stands across a wide yard, some sixty metres off (author: 这个距离太近了; the first retry put it too far and
  // repeated it mirrored, which showed as twins). One picture, about 60° of the view, its edges faded into a plain
  // ground behind it: overcast grey above the tree line, tree-dark below, so nothing repeats and nothing streaks.
  const D = 60, TW = 86, TH = TW * 928 / 1664, cy = 1.5 + TH * 0.12 - 2, line = cy - TH * 0.12;
  const [bc, bg] = canvas(8, 512), gr = bg.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#7d8389"); gr.addColorStop(0.47, "#a9adb0"); gr.addColorStop(0.495, "#59625a"); gr.addColorStop(0.51, "#1c2619"); gr.addColorStop(1, "#141b12");
  bg.fillStyle = gr; bg.fillRect(0, 0, 8, 512);
  const back = new THREE.CanvasTexture(bc); back.colorSpace = THREE.SRGBColorSpace;
  const [fc, fg] = canvas(256, 256);
  { const im = fg.createImageData(256, 256); for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const u = x / 255, v = y / 255, a = Math.min(ss(0, 0.14, u), ss(0, 0.14, 1 - u), ss(0, 0.16, v), ss(0, 0.2, 1 - v)) * 255, o = (y * 256 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = a; im.data[o + 3] = 255; } fg.putImageData(im, 0, 0); }
  const fade = new THREE.CanvasTexture(fc);
  const pic = new THREE.TextureLoader().load(new URL("./art/outside.jpg", import.meta.url).href); pic.colorSpace = THREE.SRGBColorSpace; pic.anisotropy = 8;
  const flip = pic.clone(); flip.wrapS = THREE.RepeatWrapping; flip.repeat.x = -1; flip.offset.x = 1;
  for (const [sx, zc, ry, map] of [[-1, (WIN.z0 + WIN.z1) / 2, Math.PI / 2, pic], [1, (SLIT.z0 + SLIT.z1) / 2, -Math.PI / 2, flip]]) {
    const x = sx > 0 ? X1 + D : X0 - D;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshBasicMaterial({ map: back, fog: false, toneMapped: false }));
    b.position.set(x + sx * 1.5, line, zc); b.rotation.y = ry; b.userData.noEdge = true; outside.add(b); VIEW.push(b);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map, alphaMap: fade, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    m.position.set(x, cy, zc); m.rotation.y = ry; m.userData.noEdge = true; m.isLine2 = true; outside.add(m); VIEW.push(m);
  }
}
const OUTER = { k: 0, t: 0, eye: new THREE.Group(), light: new THREE.PointLight(0xff2a1a, 0, 9, 1.6) };
const hideMap = (() => { // wet hide: dark, mottled, pocked; brighter lines where it creases
  const [c, g] = canvas(1024, 1024), R = rng(66);
  g.fillStyle = "#1a1c1b"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) blotch(g, R() * 1024, R() * 1024, 30 + R() * 110, R() < 0.5 ? "46,52,48" : "8,9,10", 0.5);
  for (let i = 0; i < 900; i++) { const x = R() * 1024, y = R() * 1024, r = 3 + R() * 9; g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * 3, 0, 7); g.fill(); g.strokeStyle = "rgba(120,130,120,.25)"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 1, r, r * 0.7, 0, 3.4, 6); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(90,20,24,${0.2 + R() * 0.3})`; g.lineWidth = 2 + R() * 5; g.beginPath(); let x = R() * 1024, y = 0; g.moveTo(x, y); while (y < 1024) { x += (R() - 0.5) * 60; y += 40 + R() * 60; g.lineTo(x, y); } g.stroke(); }
  const t = tex(c); t.repeat.set(3, 5); return t;
})();
const hide = M({ map: hideMap, bumpMap: hideMap, bumpScale: 6, roughness: 0.22, color: 0xa9b0aa }, 3);
const body = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 70, 64, 1, true), hide);
body.rotation.x = Math.PI / 2; body.position.set(X0 - 7.4, 0.6, -1); body.visible = false;
outside.add(body);
{ // the eye: a dark wet ball, a red iris with a slit in it
  const iris = face(512, 512, "#000000", (g) => {
    const grd = g.createRadialGradient(256, 256, 20, 256, 256, 250); grd.addColorStop(0, "#ff5a2a"); grd.addColorStop(0.35, "#d0141a"); grd.addColorStop(0.8, "#5a0508"); grd.addColorStop(1, "#160203");
    g.fillStyle = grd; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    const R = rng(3); g.strokeStyle = "rgba(255,170,90,.28)";
    for (let i = 0; i < 220; i++) { const a = R() * 6.283, r0 = 60 + R() * 40, r1 = 150 + R() * 95; g.lineWidth = 0.6 + R() * 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0); g.lineTo(256 + Math.cos(a + (R() - 0.5) * 0.1) * r1, 256 + Math.sin(a) * r1); g.stroke(); }
    g.fillStyle = "#020101"; g.beginPath(); g.ellipse(256, 256, 34, 205, 0, 0, 7); g.fill(); // the slit
  });
  const ballMat = patch(new THREE.MeshPhysicalMaterial({ color: 0x1a0507, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }), 3);
  const irisMat = patch(new THREE.MeshPhysicalMaterial({ map: iris, emissiveMap: iris, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), 3);
  OUTER.eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 32), ballMat));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.97, 48, 24, 0, Math.PI * 2, 0, 0.72), irisMat); cap.rotation.x = Math.PI / 2; // the pole turned to face forward
  OUTER.eye.add(cap);
  OUTER.irisMat = irisMat;
  const lidMat = hide;
  for (const k of [-1, 1]) { const lid = new THREE.Mesh(new THREE.SphereGeometry(1.06, 40, 20, 0, Math.PI * 2, 0, 1.25), lidMat); lid.rotation.x = k * 1.35 - Math.PI / 2 * 0; lid.rotation.z = 0; lid.userData.k = k; OUTER.eye.add(lid); (OUTER.lids ??= []).push(lid); }
  OUTER.eye.visible = false;
  outside.add(OUTER.eye);
  scene.add(OUTER.light);
}
// the big ones at the glass (they answer to what is outside, not to the room's own rot)
tentacle([[X0 - 4.5, -4, -2.6], [X0 - 2.2, -1.5, -2.0], [X0 - 0.9, 0.6, -1.5], [X0 - 0.42, 1.5, -1.2], [X0 - 0.36, 2.2, -0.7], [X0 - 0.5, 2.6, 0.0]], 0.2, 0.05, 0.16, true);
tentacle([[X0 - 5, -4, 1.2], [X0 - 2.6, -1.2, 0.6], [X0 - 1.0, 0.8, 0.2], [X0 - 0.4, 1.3, -0.2], [X0 - 0.38, 1.7, -0.9]], 0.16, 0.25, 0.2, true);
tentacle([[X0 - 4, 6, -1.8], [X0 - 1.8, 3.6, -1.2], [X0 - 0.6, 2.5, -0.9], [X0 - 0.36, 1.9, -0.4], [X0 - 0.4, 1.4, 0.05]], 0.14, 0.4, 0.22, true);
tentacle([[X0 - 6, 0, -5], [X0 - 3, 0.8, -3.2], [X0 - 1.2, 1.2, -2.2], [X0 - 0.5, 1.6, -1.7]], 0.26, 0.15, 0.25, true);
tentacle([[X1 + 4, -3, 1.4], [X1 + 1.6, 0.2, 1.4], [X1 + 0.42, 1.2, 1.42], [X1 + 0.36, 2.0, 1.36]], 0.11, 0.5, 0.14, true); // and one at the narrow window
function updateOutside(s, dt) {
  const want = state.outer ? 1 : 0;
  OUTER.k += (want - OUTER.k) * (1 - Math.exp(-dt * 0.5));
  if (OUTER.k < 0.002 && !want) OUTER.k = 0;
  if (Math.abs(want - OUTER.k) > 0.003) apply(); // what is outside stands in the light: the room dims as it arrives
  const k = OUTER.k;
  body.visible = k > 0.01;
  OUTER.eye.visible = false; OUTER.light.intensity = 0;
  if (!body.visible) return;
  OUTER.t += dt;
  const T = OUTER.t % 34, eyeIn = ss(11, 14.5, T), eyeOut = ss(22.5, 27, T), held = eyeIn * (1 - eyeOut);
  // the hide slides; it slows while the eye is at the window, as if the whole thing had stopped to look
  OUTER.scroll = (OUTER.scroll ?? 0) + dt * (0.5 - 0.44 * held) * k;
  hideMap.offset.y = OUTER.scroll; hideMap.offset.x = Math.sin(s * 0.07) * 0.05;
  body.position.x = X0 - 7.4 + (1 - k) * 9 + Math.sin(s * 0.23) * 0.25; // it comes in from further off
  body.position.y = 0.6 + Math.sin(s * 0.31) * 0.35;
  if (eyeIn > 0.001 && eyeOut < 0.999) {
    OUTER.eye.visible = true;
    // up from under the sill to the middle of the big window, then away along the wall
    OUTER.eye.position.set(X0 - 1.45 - (1 - eyeIn) * 1.2 - eyeOut * 1.5, 1.62 - (1 - eyeIn) * 3.2 + eyeOut * 0.4, -0.7 + eyeOut * 7.5 - (1 - eyeIn) * 0.6);
    // it finds you: first it looks along the room, then at the camera, with small jumps
    const find = ss(14.5, 16.2, T), jx = Math.sin(Math.floor(T * 1.7) * 12.9) * 0.25 * (1 - find * 0.7), jy = Math.cos(Math.floor(T * 1.3) * 7.7) * 0.18 * (1 - find * 0.7);
    _look.set(camera.position.x * find + (1 - find) * 0.4 + jx, camera.position.y * find + (1 - find) * 1.0 + jy, camera.position.z * find + (1 - find) * 2.5);
    OUTER.eye.lookAt(_look);
    const blink = ss(18.2, 18.35, T) * (1 - ss(18.45, 18.7, T)); // once
    for (const lid of OUTER.lids) lid.rotation.x = -Math.PI / 2 + lid.userData.k * (2.05 - 0.75 * blink - 0.55 * (1 - eyeIn)) + (lid.userData.k < 0 ? Math.PI : 0);
    OUTER.irisMat.emissiveIntensity = 0.7 + 0.5 * find + 0.15 * Math.sin(s * 3);
    OUTER.light.position.copy(OUTER.eye.position).x += 0.9;
    OUTER.light.intensity = held * (5 + 3 * find) * k;
  }
}

// ---------- the drawing: every hard edge of every part, shown only as the room stops being real ----------
const ink = new LineMaterial({ color: 0x1b1b1d, linewidth: 1.5, transparent: true, opacity: 0 });
const lines = [];
{
  const meshes = [];
  room.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.noEdge) meshes.push(o); });
  const fat = (edges) => { const l = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(edges), ink); l.visible = false; l.isLine2 = true; /* the occlusion pass skips what says it is a line */ lines.push(l); return l; };
  for (const o of meshes) o.add(fat(new THREE.EdgesGeometry(o.userData.edge ?? o.geometry, 32)));
  const shell = fat(new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d)));
  shell.position.set(0, ROOM.h / 2, 0);
  room.add(shell);
}

// ---------- light ----------
const hemi = new THREE.HemisphereLight(0xe8eef5, 0x8a7a66, 0.3);
scene.add(hemi);
const skyLight = new THREE.RectAreaLight(0xe9f0f8, 6, WIN.z1 - WIN.z0, WIN.y1 - WIN.y0);
skyLight.position.set(X0 + 0.02, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
skyLight.lookAt(X1, 1.0, 0);
scene.add(skyLight);
const slitLight = new THREE.RectAreaLight(0xe9f0f8, 2, SLIT.z1 - SLIT.z0, SLIT.y1 - SLIT.y0);
slitLight.position.set(X1 - 0.02, 1.5, (SLIT.z0 + SLIT.z1) / 2);
slitLight.lookAt(X0, 1.0, 0.6);
scene.add(slitLight);
const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
sun.position.set(-7, 6.5, -2.6);
sun.target.position.set(0.6, 0, 0.3);
sun.castShadow = true;
sun.shadow.mapSize.set(new URLSearchParams(location.search).get("low") === "1" ? 2048 : 4096, new URLSearchParams(location.search).get("low") === "1" ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 6;
scene.add(sun, sun.target);
const lamp = new THREE.SpotLight(0xffc98a, 0, 6, 1.05, 0.85, 1.6);
lamp.position.copy(bulb.position);
lamp.target.position.set(DESK.x + 0.1, 0.4, DESK.z + 0.25);
lamp.castShadow = true;
lamp.shadow.mapSize.set(new URLSearchParams(location.search).get("low") === "1" ? 1024 : 2048, new URLSearchParams(location.search).get("low") === "1" ? 1024 : 2048);
lamp.shadow.bias = -0.0004;
lamp.shadow.radius = 4;
scene.add(lamp, lamp.target);
const lampGlow = new THREE.PointLight(0xffc98a, 0, 3.5, 2);
lampGlow.position.copy(bulb.position).add(new THREE.Vector3(0, -0.05, 0.1));
scene.add(lampGlow);
// the ceiling light: a wide cone down into the room, and a little spill back onto the ceiling round the dish
const ceil = new THREE.SpotLight(0xfff0dc, 0, 7, 1.38, 0.7, 1.3);
ceil.position.set(0.1, ROOM.h - 0.09, 0.1);
ceil.target.position.set(0.1, 0, 0.1);
ceil.castShadow = true;
ceil.shadow.mapSize.set(new URLSearchParams(location.search).get("low") === "1" ? 1024 : 2048, new URLSearchParams(location.search).get("low") === "1" ? 1024 : 2048);
ceil.shadow.bias = -0.0004;
ceil.shadow.radius = 5;
scene.add(ceil, ceil.target);
const ceilGlow = new THREE.PointLight(0xfff0dc, 0, 4.5, 1.6);
ceilGlow.position.set(0.1, ROOM.h - 0.2, 0.1);
scene.add(ceilGlow);
const doorGap = box(DOOR.x1 - DOOR.x0 - 0.1, 0.007, 0.004, M({ color: 0x000000, emissive: 0xfff1dc, emissiveIntensity: 0 }, 3), (DOOR.x0 + DOOR.x1) / 2, 0.005, Z1 - 0.001, { cast: false, noEdge: true });
const doorLight = new THREE.RectAreaLight(0xfff1dc, 0, DOOR.x1 - DOOR.x0 - 0.1, 0.02);
doorLight.position.set((DOOR.x0 + DOOR.x1) / 2, 0.012, Z1 - 0.01);
doorLight.lookAt((DOOR.x0 + DOOR.x1) / 2, -0.3, Z1 - 1.2);
scene.add(doorLight);
const screenGlow = new THREE.RectAreaLight(0x9db8e0, 0, 1.1, 0.3);
screenGlow.position.set(DESK.x, DESK.h + 0.32, DESK.z - 0.09);
screenGlow.lookAt(DESK.x, DESK.h + 0.2, Z1);
scene.add(screenGlow);

// ---------- post: ambient occlusion seats every part on its surface ----------
const target = new THREE.WebGLRenderTarget(16, 9, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 16, 9);
gtao.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.2, thickness: 1.4, scale: 1.35, samples: 16 });
gtao.blendIntensity = 1;
if (new URLSearchParams(location.search).get("low") !== "1") composer.addPass(gtao);
composer.addPass(new OutputPass());

// ---------- state ----------
const q = new URLSearchParams(location.search);
const LOW = q.get("low") === "1"; // for weak machines: one pixel per pixel, no ambient occlusion, smaller shadow maps
const state = {
  time: Number(q.get("t") ?? 13.5),
  collapse: Number(q.get("c") ?? 0),
  unreal: Number(q.get("u") ?? 0),
  pixel: Number(q.get("px") ?? 0),
  hand: Number(q.get("hand") ?? 0),
  inspect: q.get("look") ?? "",
  inspectK: 0,
  day: Number(q.get("day") ?? 18),
  outer: q.has("outer") ? q.get("outer") === "1" : Number(q.get("day") ?? 18) === 18,
  meal: q.get("meal") ?? "auto",
  eaten: q.get("eaten") === "1",
  face: Number(q.get("f") ?? 0),
  desk: q.get("desk") === "1",
  deskK: q.get("desk") === "1" ? 1 : 0,
  yaw: 0,
  look: { x: 0, y: 0 },
  turn: null,
  lamp: q.has("lamp") ? q.get("lamp") === "1" : null, // null = by the clock (on from 18:30); a click fixes it
  ceil: q.get("ceil") === "1",
  spot: q.get("spot") ?? (Number(q.get("f") ?? 0) === 3 ? "meal" : Number(q.get("f") ?? 0) === 1 ? "slit" : "desk"),
};
state.yaw = FACES[state.face].yaw;
const eyeNow = FACES[state.face].eye.clone();
let pitchNow = FACES[state.face].pitch, yawOffNow = FACES[state.face].yawOff ?? 0;
if (q.get("solo") === "1") document.body.classList.add("solo");
if (q.get("rain") === "1") rain.visible = true;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);
const SKY = { day: C(0xcfd6dc), dusk: C(0xd7a983), night: C(0x0a0e1a) };
const TINT = { clean: C(0xffffff), rot: C(0xff5a3c) };
const LIGHT = { day: C(0xe9f0f8), dusk: C(0xffc7a0), night: C(0x41506e) };
const WHITE = C(0xf3f2ee);
let drift = 0;
// A vision (author 2026-11-16): the black-and-white drawing is not a state the room stays in. It cuts in
// and out against the normal room for a few seconds, at uneven intervals, and is gone.
let visionEnd = 0, visionBase = 0;
const visionOn = (ms) => { const h = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }; return h(Math.floor(ms / 240)) > 0.5 ? h(Math.floor(ms / 55) + 7) > 0.25 : h(Math.floor(ms / 55) + 3) > 0.85; };

// The pixel and unreal sliders run 0–1 over the part of each effect that is ever wanted (author 2026-11-16:
// pixels full at what used to be 20 %, unreal full at 40 %), so the bar is finer. The vision's white flash is its own switch.
const PX_MAX = 0.2, UN_MAX = 0.4;
let flash = false;
function apply() {
  const t = state.time, c = state.collapse, u = flash ? 1 : state.unreal * UN_MAX;
  const white = smooth(0.45, 1, u);
  drift = smooth(0.12, 0.85, visionEnd ? visionBase : u); // things do not jump off the desk for a flash
  U.uCollapse.value = c;
  U.uWhite.value = white;
  U.uPixel.value = state.pixel * PX_MAX;
  ink.opacity = smooth(0, 0.3, u) * 0.9;
  for (const l of lines) l.visible = u > 0;
  const day = 1 - smooth(16.8, 19.6, t);
  const dusk = smooth(16, 18, t) * (1 - smooth(18.2, 19.8, t));
  const lampOn = (state.lamp ?? t >= 18.5) ? 1 : 0, ceilOn = state.ceil ? 1 : 0;
  const tint = TINT.clean.clone().lerp(TINT.rot, c * 0.45);
  const sky = SKY.night.clone().lerp(SKY.day, day).lerp(SKY.dusk, dusk * 0.7);
  sky.lerp(C(0x1a0605), c * (0.8 - 0.5 * day)).lerp(WHITE, white);
  scene.background = sky;
  for (const m of VIEW) m.material.color.setScalar(0.06 + 0.9 * day).lerp(C(0x3a0c0a), c * 0.45 * (1 - 0.5 * day)).lerp(WHITE, white);
  const lightCol = LIGHT.night.clone().lerp(LIGHT.day, day).lerp(LIGHT.dusk, dusk * 0.8).multiply(tint);
  skyLight.color.copy(lightCol);
  slitLight.color.copy(lightCol);
  skyLight.intensity = (0.5 + 7.5 * day) * (1 - c * 0.15) * (1 - 0.8 * OUTER.k); // daylight stays daylight as the room goes wrong (author: 不一定只有黑乎乎才是恐怖)
  slitLight.intensity = (0.25 + 2.6 * day) * (1 - c * 0.15);
  hemi.color.copy(lightCol);
  hemi.intensity = (0.05 + 0.42 * day) * (1 - c * 0.2) + ceilOn * 0.1;
  sun.intensity = 3.6 * day * (1 - dusk * 0.4) * (1 - c * 0.25) * (1 - 0.95 * OUTER.k);
  sun.color.copy(C(0xfff4e6).lerp(C(0xff9a5c), dusk)).multiply(tint);
  scene.environmentIntensity = (0.04 + 0.32 * day) * (1 - c * 0.3) + ceilOn * 0.06;
  const lampCol = C(0xffc98a).lerp(C(0xff2a1a), c);
  lamp.color.copy(lampCol); lampGlow.color.copy(lampCol);
  lamp.intensity = lampOn * 9;
  lampGlow.intensity = lampOn * 0.5;
  mat.bulb.emissive.copy(lampCol);
  mat.bulb.emissiveIntensity = lampOn * 4;
  const ceilCol = C(0xfff0dc).lerp(C(0xffc9b8), c * 0.6);
  ceil.color.copy(ceilCol); ceilGlow.color.copy(ceilCol);
  ceil.intensity = ceilOn * 17; ceilGlow.intensity = ceilOn * 1.5;
  mat.dish.emissive.copy(ceilCol); mat.dish.emissiveIntensity = ceilOn * 2.6;
  if (ROCKER) ROCKER.rotation.x = ceilOn ? -0.08 : 0.08;
  document.getElementById("lampOn").checked = !!lampOn; document.getElementById("ceilOn").checked = !!ceilOn;
  { // the corridor's light under the door; from day 10 it is not the corridor's
    const col = C(state.day >= 10 ? 0xff5fa2 : 0xfff1dc);
    doorGap.material.emissive.copy(col); doorGap.material.emissiveIntensity = (1 - day) * 3;
    doorLight.color.copy(col); doorLight.intensity = (1 - day) * 14;
  }
  mat.screen.emissiveIntensity = (1 - day) * 0.35;
  screenGlow.intensity = (1 - day) * 1.2;
  for (const m of facades) m.emissiveIntensity = (1 - day) * 1.6 * (1 - c);
  scene.fog.color.copy(C(0x2a0d0a).lerp(WHITE, white));
  scene.fog.density = c * (0.03 + 0.05 * (1 - day)) * (1 - 0.5 * ceilOn) * (1 - white) + white * 0.035;
  renderer.toneMappingExposure = 0.9 + (1 - day) * 0.26;
  const hh = Math.floor(t) % 24, mm = Math.round((t - Math.floor(t)) * 60) % 60;
  document.getElementById("timeV").textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  document.getElementById("collapseV").textContent = `${Math.round(c * 100)}%`;
  document.getElementById("unrealV").textContent = `${Math.round(state.unreal * 100)}%`;
  document.getElementById("pixelV").textContent = `${Math.round(state.pixel * 100)}%`;
}
// Places to walk up to. Each belongs to one wall; the desk and the meal table are looked down at, the two
// windows are looked out of (author 2026-11-16: both windows can be approached, so the block opposite can carry anomalies).
const SPOTS = {
  desk: { face: 0, eye: DESK_EYE, pitch: -1.02, fov: 52, name: "桌面", go: "走到桌前" },
  meal: { face: 3, eye: MEAL_EYE, pitch: -0.74, fov: 30, name: "饭桌", go: "走到饭桌前" },
  win: { face: 3, eye: new THREE.Vector3(X0 + 0.5, 1.52, (WIN.z0 + WIN.z1) / 2), pitch: -0.02, fov: 36, name: "大窗前", go: "走到窗前" },
  slit: { face: 1, eye: new THREE.Vector3(X1 - 0.45, 1.5, (SLIT.z0 + SLIT.z1) / 2), pitch: -0.02, fov: 36, name: "小窗前", go: "走到小窗前" },
};
const spotsOf = (face) => Object.keys(SPOTS).filter((k) => SPOTS[k].face === face);
function showFace() {
  const f = FACES[state.face];
  const name = state.desk ? SPOTS[state.spot].name : f.name;
  document.getElementById("faceName").textContent = `· ${name}`;
  document.getElementById("photoName").textContent = `· ${name}`;
  document.getElementById("photo").src = state.desk && state.spot === "desk" ? DESK_PHOTO : f.photo;
  const here = spotsOf(state.face), b1 = document.getElementById("desk"), b2 = document.getElementById("spot2");
  b1.textContent = state.desk ? "退回房间" : here[0] ? SPOTS[here[0]].go : "这面墙没有可走近的";
  b1.disabled = !state.desk && !here[0];
  b2.style.display = !state.desk && here[1] ? "" : "none";
  if (here[1]) b2.textContent = SPOTS[here[1]].go;
}
function turn(dir) {
  if (state.turn || state.desk) return;
  const from = state.yaw;
  const eyeFrom = eyeNow.clone();
  state.face = (state.face + dir + 4) % 4;
  state.turn = { from, to: from - dir * Math.PI / 2, start: performance.now(), eyeFrom, eyeTo: FACES[state.face].eye, pitchFrom: pitchNow, yawOffFrom: yawOffNow };
  showFace();
}
function toDesk(spot) {
  if (state.turn) return;
  if (!state.desk) {
    const here = spotsOf(state.face), pick = typeof spot === "string" && here.includes(spot) ? spot : here[0];
    if (!pick) return;
    state.spot = pick;
  }
  state.desk = !state.desk;
  showFace();
}

function resize() {
  const r = document.getElementById("frame").getBoundingClientRect();
  const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
  const pr = LOW ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  ink.resolution.set(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const KEYS = ["time", "collapse", "pixel", "unreal"];
let goal = null, goalRate = 0.9;
let last = performance.now(), dragging = null, framesDrawn = 0;
const perf = { first: 0, t: 0, n: 0 };

// ================= the pull-back (author 2026-11-16) =================
// 「拉远视角，3d的房间缩小，外面是巨大的克总微微低头看着这个房间…铺满触手的黑暗世界」. The eye leaves through the ceiling;
// the room is a small lit box on a plain of tentacles, and the one whose room it is looks down into it.
// First build: shapes and light only. The head is read from the dog he has been all along, grown, with a beard of tentacles.
const FAR = { on: false, k: 0, g: new THREE.Group(), head: new THREE.Group() };
FAR.g.visible = false;
scene.add(FAR.g);
{
  const R = rng(1818);
  const dark = M({ map: hideMap, bumpMap: hideMap, bumpScale: 5, roughness: 0.3, color: 0x5a5560 }, 3);
  const wine = M({ color: 0x3a0d18, roughness: 0.32 }, 3);
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, par = FAR.head) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.userData.noEdge = true; o.frustumCulled = false; par.add(o); return o; };
  // He is not modelled here: he is the picture the battle already uses (public/battle/boss-giant.jpg, the horned head
  // with the lit eyes), stood up far behind the room as one great card, its edges lost in the smoke.
  const CAM = new THREE.Vector3(9, 7.5, 17), AIM = new THREE.Vector3(-2, 5.5, -6);
  FAR.cam2 = new THREE.Vector3(40, 60, 85); FAR.aim2 = new THREE.Vector3(-2, 18, -6); // further: he stays the size he is, the room shrinks, the ground turns out to be round
  FAR.RP = 500;
  FAR.cam = CAM; FAR.aim = AIM;
  const pic = new THREE.TextureLoader().load("/battle/boss-giant.jpg"); pic.colorSpace = THREE.SRGBColorSpace;
  const [fc, fg] = canvas(512, 512), grad = fg.createRadialGradient(256, 236, 120, 256, 256, 256);
  grad.addColorStop(0, "#fff"); grad.addColorStop(0.6, "#fff"); grad.addColorStop(1, "#000"); fg.fillStyle = grad; fg.fillRect(0, 0, 512, 512);
  const fade = new THREE.CanvasTexture(fc);
  FAR.card = new THREE.Mesh(new THREE.PlaneGeometry(128, 71.5), new THREE.MeshBasicMaterial({ map: pic, alphaMap: fade, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  FAR.card.renderOrder = -1; FAR.card.userData.noEdge = true;
  FAR.g.add(FAR.card);
  // the plain: cracked ground with fire in the cracks, as in the picture, and them lying over it: long, whole,
  // thick where they leave the ground and drawn out to a point (the first build's were short pipes with cut ends)
  const [gc, gg] = canvas(1024, 1024);
  gg.fillStyle = "#000"; gg.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { gg.strokeStyle = `rgba(255,${20 + Math.floor(R() * 50)},16,${0.4 + R() * 0.6})`; gg.lineWidth = 1 + R() * 3.5; gg.beginPath(); let x = R() * 1024, y = R() * 1024, a = R() * 6.28; gg.moveTo(x, y); for (let k = 0; k < 9; k++) { a += (R() - 0.5) * 1.5; x += Math.cos(a) * (30 + R() * 70); y += Math.sin(a) * (30 + R() * 70); gg.lineTo(x, y); } gg.stroke(); }
  const cracks = new THREE.CanvasTexture(gc); cracks.wrapS = cracks.wrapT = THREE.RepeatWrapping; cracks.repeat.set(90, 45); cracks.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.SphereGeometry(FAR.RP, 128, 64, 0, Math.PI * 2, 0, 0.7), M({ color: 0x0b0a0a, roughness: 0.95, emissive: 0xffffff, emissiveMap: cracks, emissiveIntensity: 1.3 }, 3)); ground.position.y = -FAR.RP - 0.35; /* a world, not a floor */ ground.userData.noEdge = true; FAR.g.add(ground);
  const geos = [], c3 = new THREE.Vector3();
  for (let i = 0; i < 3200; i++) { // enough of them that no ground shows between
    const a = R() * Math.PI * 2, d = 2.2 + Math.pow(R(), 0.55) * 250, len = 9 + R() * 16 + d * 0.16, r = 0.22 + R() * 0.5 + d * 0.022;
    let x = Math.cos(a) * d, z = Math.sin(a) * d, th = a + Math.PI / 2 + (R() - 0.5) * 1.2; const pts = [], n = 8, hump = 1 + Math.floor(R() * (n - 2));
    for (let k = 0; k <= n; k++) { pts.push(new THREE.Vector3(x, (k === 0 ? -0.9 - r : -0.35 + r * 0.55 * (1 - k / n) + (k === hump ? r * (0.8 + R() * 2.2) : 0)) - (x * x + z * z) / (2 * FAR.RP), z)); th += (R() - 0.5) * 0.7; x += Math.cos(th) * len / n; z += Math.sin(th) * len / n; }
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"), geo = new THREE.TubeGeometry(curve, 22, 1, 6), P = geo.attributes.position;
    for (let v = 0; v < P.count; v++) { const t = Math.floor(v / 7) / 22, rr = r * Math.pow(1 - t, 0.7) * (1 + 0.05 * Math.sin(t * 60)) + 0.01; curve.getPointAt(Math.min(1, t), c3); P.setXYZ(v, c3.x + (P.getX(v) - c3.x) * rr, c3.y + (P.getY(v) - c3.y) * rr, c3.z + (P.getZ(v) - c3.z) * rr); }
    geo.computeVertexNormals(); geos.push(geo);
  }
  const hideFar = hideMap.clone(); hideFar.repeat.set(10, 2); hideFar.needsUpdate = true;
  const carpet = new THREE.Mesh(mergeGeometries(geos), M({ map: hideFar, bumpMap: hideFar, bumpScale: 4, roughness: 0.3, color: 0xd98a8a, emissive: 0xff2616, emissiveMap: hideFar, emissiveIntensity: 0.34 }, 3)); carpet.userData.noEdge = true; /* flesh under the hide, and wet */ carpet.frustumCulled = false; FAR.g.add(carpet);
  FAR.dome = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.MeshBasicMaterial({ color: 0x1d1d1f, side: THREE.BackSide, fog: false, transparent: true, opacity: 0, depthWrite: false })); FAR.dome.renderOrder = -2; FAR.g.add(FAR.dome);
  FAR.glow = new THREE.PointLight(0xffd9a8, 0, 70, 1.2); FAR.glow.position.set(0.1, 2.4, 0.1); FAR.g.add(FAR.glow);
  { const [oc, og] = canvas(256, 256), gr = og.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,250,235,1)"); gr.addColorStop(0.12, "rgba(255,226,170,.95)"); gr.addColorStop(0.4, "rgba(255,170,90,.28)"); gr.addColorStop(1, "rgba(255,140,60,0)");
    og.fillStyle = gr; og.fillRect(0, 0, 256, 256);
    FAR.orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(oc), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    FAR.orb.position.set(0.1, 2.2, 0.1); FAR.orb.visible = false; FAR.orb.isLine2 = true; /* so the occlusion pass leaves it alone, as it does the ink lines */ FAR.g.add(FAR.orb); } // the room, seen from out here, is a lamp
  FAR.reds = []; // the red comes up from between them, here and there, and breathes
  for (let i = 0; i < 9; i++) { const a = i * 2.4 + 0.7, d = i === 0 ? 7 : 14 + i * 12, l = new THREE.PointLight(0xff2414, 0, 55 + d * 0.5, 1.15); l.position.set(Math.cos(a) * d, 1.2 - (d * d) / (2 * FAR.RP), Math.sin(a) * d); l.userData = { i: (160 + d * 6) * 3.6, ph: i * 1.9 }; FAR.g.add(l); FAR.reds.push(l); }
  FAR.rim = new THREE.DirectionalLight(0xb9bcc6, 0); FAR.rim.position.set(-20, 30, -40); FAR.rim.target.position.set(-10.5, 12, -12); FAR.g.add(FAR.rim, FAR.rim.target);
  FAR.fill = new THREE.PointLight(0xff8a3a, 0, 140, 1.1); FAR.fill.position.set(-6, 14, -10); FAR.g.add(FAR.fill);
}
const _fp = new THREE.Vector3(), _fl = new THREE.Vector3(), _fq = new THREE.Quaternion(), _fm = new THREE.Matrix4();
function updateFar(s, dt) {
  FAR.k += ((FAR.to ?? 0) - FAR.k) * (1 - Math.exp(-dt * 5)); if (Math.abs(FAR.k - (FAR.to ?? 0)) < 0.0005) FAR.k = FAR.to ?? 0; // the player's own hand on the bar (author: 做成滑杆，到时候是用户拉远的)
  const k = FAR.k, e = k * k * (3 - 2 * k);
  FAR.g.visible = k > 0;
  CEIL.visible = k < 0.03;
  outside.visible = k < 0.25;
  { // from outside it is still the room, small: its floor and what stands on it, no walls, no ceiling, with only a
    // little light of its own. Most of the light out here comes up from the ground (author 2026-11-16, third pass).
    if (!FAR.shell) {
      FAR.shell = []; const b = new THREE.Box3(), c = new THREE.Vector3();
      room.updateWorldMatrix(true, true);
      room.traverse((o) => {
        if (!o.isMesh && !o.isLineSegments2) return;
        if (o.isInstancedMesh || o === CEIL || tentacles.some((t) => t.mesh === o)) return;
        b.setFromObject(o).getCenter(c);
        if (c.x < X0 + 0.16 || c.x > X1 - 0.16 || c.z < Z0 + 0.16 || c.z > Z1 - 0.16) FAR.shell.push(o);
      });
    }
    const gone = k > 0.06;
    if (FAR.gone !== gone) { if (!gone) apply(); FAR.gone = gone; for (const o of FAR.shell) o.visible = !gone; for (const t of tentacles) if (gone) t.mesh.visible = false; SUCK.visible = !gone; }
    if (gone) { for (const t of tentacles) t.mesh.visible = false; for (const l of lines) l.visible = false; } // the ink edges of the missing walls would hang in the air as a wire box (author: 房子上面有几条边有点奇怪)
    FAR.orb.visible = gone; FAR.orb.material.opacity = Math.min(1, (k - 0.06) * 6) * 0.2;
    FAR.orb.scale.setScalar(9 + 8 * Math.max(0, (e - 0.42) / 0.58));
    for (const l of FAR.reds) l.intensity = e * l.userData.i * (0.85 + 0.15 * Math.sin(s * 0.6 + l.userData.ph));
  }
  FAR.glow.intensity = e * 10;
  if (!k) return;
  FAR.dome.material.opacity = Math.min(1, e * 1.6);
  FAR.card.material.opacity = Math.min(1, Math.max(0, e * 4 - 0.5));
  FAR.rim.intensity = e * 0.35; FAR.fill.intensity = e * 30;
  scene.fog.color.lerp(C(0x1d1d1f), e);
  scene.fog.density = scene.fog.density * (1 - e) + (0.016 - 0.0105 * Math.max(0, (e - 0.42) / 0.58)) * e; // the plain goes on into the smoke
  // two legs. First up through the ceiling and back until the room is small in front and he stands over it;
  // then on, up and away: he does not get smaller, the room does, and the plain bends away on every side.
  const u = Math.min(1, e / 0.42), u2 = Math.max(0, (e - 0.42) / 0.58), v = u * u * (3 - 2 * u), w = u2 * u2 * (3 - 2 * u2);
  _fp.set(1.5 + (FAR.cam.x - 1.5) * v, 1.4 + (FAR.cam.y - 1.4) * v + 4.2 * Math.sin(Math.PI * v), 1.2 + (FAR.cam.z - 1.2) * v).lerp(FAR.cam2, w);
  _fl.set(FAR.aim.x * v, 1.0 + (FAR.aim.y - 1.0) * v, FAR.aim.z * v).lerp(FAR.aim2, w);
  camera.position.lerp(_fp, Math.min(1, e * 4));
  _fm.lookAt(camera.position, _fl, UP); _fq.setFromRotationMatrix(_fm);
  camera.quaternion.slerp(_fq, Math.min(1, e * 4));
  // he is carried with the eye, so he keeps his size whatever the distance
  camera.updateMatrixWorld();
  FAR.card.quaternion.copy(camera.quaternion);
  FAR.card.position.set(0, 21 + 1.5 * w, -85).applyMatrix4(camera.matrixWorld);
  const fov = 47 + 6 * e; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.turn) {
    const p = Math.min(1, (now - state.turn.start) / 650), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    state.yaw = state.turn.from + (state.turn.to - state.turn.from) * e;
    eyeNow.lerpVectors(state.turn.eyeFrom, state.turn.eyeTo, e);
    pitchNow = state.turn.pitchFrom + (FACES[state.face].pitch - state.turn.pitchFrom) * e;
    yawOffNow = state.turn.yawOffFrom + ((FACES[state.face].yawOff ?? 0) - state.turn.yawOffFrom) * e;
    if (p >= 1) { state.yaw = FACES[state.face].yaw; eyeNow.copy(FACES[state.face].eye); pitchNow = FACES[state.face].pitch; yawOffNow = FACES[state.face].yawOff ?? 0; state.turn = null; }
  }
  state.deskK += ((state.desk ? 1 : 0) - state.deskK) * (1 - Math.exp(-dt * 5));
  const k = state.deskK * state.deskK * (3 - 2 * state.deskK);
  if (!dragging && (state.look.x || state.look.y)) {
    const f = Math.exp(-dt * 6);
    state.look.x *= f; state.look.y *= f;
    if (Math.abs(state.look.x) + Math.abs(state.look.y) < 0.001) state.look.x = state.look.y = 0;
  }
  // a head turns on a neck: the eye swings sideways a little as it rotates, which is where the parallax comes from
  const yaw = state.yaw + yawOffNow * (1 - k) - state.look.x * 0.3 * (1 - k * 0.5), pitch = -state.look.y * 0.16 + pitchNow * (1 - k) + k * SPOTS[state.spot].pitch;
  camera.rotation.set(pitch, yaw, 0);
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  camera.position.copy(eyeNow).lerp(SPOTS[state.spot].eye, k).addScaledVector(right, state.look.x * 0.14);
  camera.position.y += state.look.y * -0.05 + Math.sin(now / 2600) * 0.003;
  const fov0 = FACES[state.face].fov ?? 47;
  let fov = fov0 + k * (SPOTS[state.spot].fov - fov0); // a longer lens on the meal table, a wider one at a window
  { // lean in over one thing: close, a long lens, a slow drift round it
    const o = OBJ[state.inspect];
    state.inspectK += ((o ? 1 : 0) - state.inspectK) * (1 - Math.exp(-dt * 4));
    const ik = state.inspectK * state.inspectK * (3 - 2 * state.inspectK), tg = o ?? OBJ[state.lastInspect];
    if (tg && ik > 0.001) {
      if (!tg.userData.r) { const b = new THREE.Box3().setFromObject(tg), sp = b.getBoundingSphere(new THREE.Sphere()); tg.userData.r = Math.min(0.12, Math.max(0.035, sp.radius)); tg.userData.cy = sp.center.y - tg.position.y; }
      const a = Math.sin(now / 4200) * 0.5, rr = tg.userData.r;
      _t.set(tg.position.x + Math.sin(a) * rr * 2.2, tg.position.y + 0.06 + rr * 3.0, tg.position.z + Math.cos(a) * rr * 3.4);
      _c.copy(camera.position).lerp(_t, ik);
      const qa = camera.quaternion.clone();
      camera.position.copy(_t); camera.lookAt(tg.position.x, tg.position.y + (tg.userData.cy ?? 0.012), tg.position.z);
      const qb = camera.quaternion.clone();
      camera.position.copy(_c); camera.quaternion.copy(qa).slerp(qb, ik);
      fov += (24 - fov) * ik;
    }
    if (o) state.lastInspect = state.inspect;
  }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  U.uTime.value = now / 1000;
  if (visionEnd) {
    const on = now < visionEnd && visionOn(now);
    if (flash !== on) { flash = on; apply(); }
    if (now >= visionEnd) { visionEnd = 0; flash = false; apply(); }
  }
  if (goal) { // a preset is a place the four numbers walk to, slowly
    let far = 0;
    for (const key of KEYS) {
      if (!(key in goal)) continue;
      const d = goal[key] - state[key];
      far = Math.max(far, Math.abs(d) / (key === "time" ? 10 : 1));
      state[key] += d * (1 - Math.exp(-dt * goalRate));
      document.getElementById(key).value = String(state[key]);
    }
    if (far < 0.002) { for (const key of KEYS) if (key in goal) state[key] = goal[key]; goal = null; }
    apply();
  }
  updateTentacles(now / 1000);
  updateOutside(now / 1000, dt);
  updateHand(now / 1000);
  updateCoffee(now / 1000, dt);
  // things let go of the surfaces they were on, slowly, each at its own height
  for (const f of floats) {
    const s = now / 1000;
    f.g.position.y = f.y + drift * f.amp * (0.75 + 0.25 * Math.sin(s * 0.35 + f.ph));
    f.g.rotation.x = drift * 0.14 * Math.sin(s * 0.21 + f.ph);
    f.g.rotation.z = drift * 0.12 * Math.sin(s * 0.17 + f.ph * 1.7);
  }
  if (rain.visible) {
    for (let i = 0; i < RAIN_N; i++) {
      const s = rainSeed[i];
      s.y -= s.v * dt;
      if (s.y < -3) s.y += 9;
      rainPos.set([s.x, s.y, s.z, s.x + 0.02, s.y - 0.22, s.z], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  updateFar(now / 1000, dt);
  composer.render();
  if (++framesDrawn === 3) { try { window.parent !== window && window.parent.postMessage({ source: "nt-room", type: "ready" }, "*"); } catch {} document.getElementById("loading").style.opacity = "0"; perf.first = (now - T0) / 1000; perf.t = now; perf.n = 0; }
  if (framesDrawn > 3 && ++perf.n === 90) { document.getElementById("perf").textContent = `首屏 ${perf.first.toFixed(1)} 秒 · ${Math.round(90000 / (now - perf.t))} 帧/秒${LOW ? " · 低配" : ""}`; perf.t = now; perf.n = 0; }
}

// ---------- input ----------
canvasEl.addEventListener("pointerdown", (e) => {
  dragging = { x: e.clientX, y: e.clientY, lx: state.look.x, ly: state.look.y };
  canvasEl.setPointerCapture(e.pointerId);
});
canvasEl.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const w = canvasEl.clientWidth;
  state.look.x = Math.max(-1, Math.min(1, dragging.lx - ((e.clientX - dragging.x) / w) * 2.2));
  state.look.y = Math.max(-1, Math.min(1, dragging.ly - ((e.clientY - dragging.y) / w) * 2.2));
});
const ray = new THREE.Raycaster();
const B3 = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
const BOX = {
  meal: B3(MTX - 0.4, 0.2, MTZ - 0.4, MTX + 0.4, 0.95, MTZ + 0.4),
  win: B3(X0 - 0.2, WIN.y0, WIN.z0, X0 + 0.1, WIN.y1, WIN.z1),
  slit: B3(X1 - 0.1, SLIT.y0, SLIT.z0, X1 + 0.2, SLIT.y1, SLIT.z1),
  desk: B3(DESK.x - 0.8, 0.6, DESK.z - 0.4, DESK.x + 0.8, 1.35, DESK.z + 0.4),
};
const drop = (e) => { // a click that did not drag: if it was on the mug, take a sip
  if (dragging && e && Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 5) {
    const r = canvasEl.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (ray.intersectObject(COFFEE.inner, true).length) drink("sip");
    else if (ray.intersectObject(SWITCH, true).length) { state.ceil = !state.ceil; click(); apply(); }
    else if (ray.intersectObjects([SHADE, bulb], true).length) { state.lamp = !(state.lamp ?? state.time >= 18.5); click(); apply(); }
    else if (!state.desk) { // walk up to what was clicked
      const hit = (b) => ray.ray.intersectsBox(b);
      if (state.face === 3 && hit(BOX.meal)) toDesk("meal");
      else if (state.face === 3 && hit(BOX.win)) toDesk("win");
      else if (state.face === 1 && hit(BOX.slit)) toDesk("slit");
      else if (state.face === 0 && hit(BOX.desk)) toDesk("desk");
    }
  }
  dragging = null;
};
canvasEl.addEventListener("pointerup", drop);
canvasEl.addEventListener("pointercancel", drop);
for (const [id, dir] of [["turnL", -1], ["turnR", 1], ["bL", -1], ["bR", 1]]) document.getElementById(id).addEventListener("click", () => turn(dir));
document.getElementById("desk").addEventListener("click", () => toDesk());
document.getElementById("spot2").addEventListener("click", () => toDesk(spotsOf(state.face)[1]));
addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") turn(-1); if (e.key === "ArrowRight") turn(1); });
const bind = (key) => {
  const el = document.getElementById(key);
  el.value = String(state[key]);
  el.addEventListener("input", () => { goal = null; state[key] = Number(el.value); apply(); });
};
KEYS.forEach(bind);
const dayEl = document.getElementById("day"), mealEl = document.getElementById("meal"), eatenEl = document.getElementById("eaten");
dayEl.value = String(state.day); mealEl.value = state.meal; eatenEl.checked = state.eaten;
dayEl.addEventListener("input", () => { state.day = Number(dayEl.value); state.outer = state.day === 18; document.getElementById("outer").checked = state.outer; goalRate = 1.4; goal = dayLook(state.day); applyDay(); apply(); });
mealEl.addEventListener("change", () => { state.meal = mealEl.value; applyDay(); });
eatenEl.addEventListener("change", () => { state.eaten = eatenEl.checked; applyDay(); });
document.getElementById("time").addEventListener("input", applyDay);
const outerEl = document.getElementById("outer");
outerEl.checked = state.outer;
outerEl.addEventListener("change", () => { state.outer = outerEl.checked; OUTER.t = 0; });
const lookEl = document.getElementById("look");
lookEl.value = state.inspect;
lookEl.addEventListener("change", () => { state.inspect = lookEl.value; applyDay(); });
for (const b of document.querySelectorAll("[data-drink]")) b.addEventListener("click", () => drink(b.dataset.drink));
for (const b of document.querySelectorAll("[data-give]")) b.addEventListener("click", () => { if (!HAND.spec || give) return; state.hand = 1; document.getElementById("hand").value = "1"; work.visible = false; give = { verdict: b.dataset.give, t0: performance.now() / 1000 + 1.2 }; }); // it comes first, then you hand it over
document.getElementById("dropOn").addEventListener("change", (e) => { document.getElementById("drop").dataset.on = e.target.checked ? "1" : "0"; });
const handEl = document.getElementById("hand");
handEl.value = String(state.hand);
handEl.addEventListener("input", () => { state.hand = Number(handEl.value); });

// The waking flash (author 2026-11-16): one morning the room is already like this. She says one line,
// looks all the way round, and by the time she faces the desk again it is an ordinary room: the photo.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let waking = false;
async function wake() {
  if (waking || state.turn) return;
  waking = true;
  const cap = document.getElementById("caption"), still = document.getElementById("still");
  if (state.desk) toDesk();
  goal = null;
  Object.assign(state, { time: 13.5, collapse: 0.82, pixel: 0.8, unreal: 0 });
  KEYS.forEach((key) => { document.getElementById(key).value = String(state[key]); });
  apply();
  while (state.face !== 0) { turn(1); await wait(750); }
  still.style.opacity = "0";
  cap.textContent = "我这是还没睡醒吗。";
  cap.style.opacity = "1";
  await wait(2200);
  for (let i = 0; i < 4; i++) {
    if (i === 2) { goalRate = 1.5; goal = { time: 13.5, collapse: 0, pixel: 0, unreal: 0 }; cap.style.opacity = "0"; } // it drains while her back is to the desk
    turn(1);
    await wait(1250);
  }
  while (goal) await wait(100);
  still.style.opacity = "1"; // the hand-over: the computed room gives way to the photographed one
  await wait(3200);
  still.style.opacity = "0";
  waking = false;
}
document.getElementById("wake").addEventListener("click", wake);
document.getElementById("far").addEventListener("input", (e) => { FAR.to = Number(e.target.value); document.getElementById("farV").textContent = `${Math.round(FAR.to * 100)}%`; });
document.getElementById("lampOn").addEventListener("change", (e) => { state.lamp = e.target.checked; click(); apply(); });
document.getElementById("ceilOn").addEventListener("change", (e) => { state.ceil = e.target.checked; click(); apply(); });
document.getElementById("vision").addEventListener("click", () => { if (visionEnd) return; goal = null; visionBase = state.unreal * UN_MAX; visionEnd = performance.now() + 3200; });
const rainEl = document.getElementById("rain");
rainEl.checked = rain.visible;
rainEl.addEventListener("change", () => { rain.visible = rainEl.checked; });
document.getElementById("solo").addEventListener("click", () => { document.body.classList.toggle("solo"); resize(); });
new ResizeObserver(resize).observe(document.getElementById("frame"));

if (!q.has("c") && !q.has("px") && !q.has("u")) Object.assign(state, dayLook(state.day));
KEYS.forEach((key) => { document.getElementById(key).value = String(state[key]); });
apply();
applyDay();
showFace();
resize();
renderer.setAnimationLoop(frame);

// ================= embedded use =================
// ?embed=1: nothing but the picture, filling the frame, driven from outside. The game puts this page in an <iframe>
// (so three.js loads only when a 3D view is first shown) and posts { target: "nt-room", ... } messages:
//   day 1–18 · time 13.5–24 · face 0 desk wall / 1 bed / 2 door / 3 window · spot "desk" | "meal" | "win" | "slit" | null
//   lamp, ceil true/false · rain, outer true/false · far 0–1 · eaten true/false · wake true · vision true
// It answers { source: "nt-room", type: "ready" } once the first frames are drawn, and "arrived" when a move ends.
function setFace(n) {
  if (state.desk) { state.desk = false; }
  state.turn = null; state.face = ((n % 4) + 4) % 4;
  const f = FACES[state.face];
  state.yaw = f.yaw; eyeNow.copy(f.eye); pitchNow = f.pitch; yawOffNow = f.yawOff ?? 0;
  showFace();
}
function setSpot(spot) {
  if (spot && SPOTS[spot]) { if (state.face !== SPOTS[spot].face) setFace(SPOTS[spot].face); state.spot = spot; state.desk = true; }
  else state.desk = false;
  showFace();
}
const ui = (id, v) => { const e = document.getElementById(id); if (!e) return; if (e.type === "checkbox") { e.checked = !!v; e.dispatchEvent(new Event("change", { bubbles: true })); } else { e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); } };
function command(m) {
  if (m.day != null) { ui("day", m.day); if (m.snap !== false) { Object.assign(state, dayLook(state.day)); goal = null; apply(); } }
  if (m.time != null) { ui("time", m.time); state.time = Number(m.time); apply(); }
  if (m.face != null) setFace(Number(m.face));
  if ("spot" in m) setSpot(m.spot);
  if (m.lamp != null) { state.lamp = !!m.lamp; apply(); }
  if (m.ceil != null) { state.ceil = !!m.ceil; apply(); }
  if (m.rain != null) ui("rain", m.rain);
  if (m.outer != null) ui("outer", m.outer);
  if (m.eaten != null) ui("eaten", m.eaten);
  if (m.far != null) FAR.to = Math.max(0, Math.min(1, Number(m.far)));
  if (m.wake) wake();
  if (m.vision) document.getElementById("vision").click();
}
window.addEventListener("message", (e) => { const m = e.data; if (m && m.target === "nt-room") command(m); });
if (q.get("embed") === "1") { document.body.classList.add("embed", "solo"); resize(); }
window.proto = { command, setFace, setSpot, FAR, state, apply, turn, toDesk, frame, handAnchor, work, drink, COFFEE, OUTER, give: (v) => { state.hand = 1; give = { verdict: v, t0: performance.now() / 1000 }; } };
