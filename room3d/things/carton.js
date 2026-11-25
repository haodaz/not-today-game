// The carton (no sender): one small box loose each day. Moved out of room.js to the
// things contract (room3d/things/CONTRACT.md, 2026-11-25); the drawing is unchanged.
// The carton between the desk and the bed (author 2026-11-18: 目前几个面儿是碎的 — its flaps were four loose boards hanging
// in the air near it). One piece of board, folded: four walls, and a flap growing out of the top edge of each wall,
// turned about that edge. Shut and taped on the day it comes; after that the flaps stand as they were left: the near
// one fallen right over, the far one upright, the side ones out at their own angles. Cut tape on the long flaps and
// down the walls, a carrier's label and a printed arrow on the near wall, a hand hole in each short side.
export default {
  id: "carton",
  slot: "carton",
  float: 0.3,
  build({ THREE, M, mat, box, face, add, into }) {
    const w = 0.4, h = 0.33, d = 0.34, t = 0.006, L = d / 2 - 0.004;
    const edge = M({ color: 0x9a7a52, roughness: 1 }); // the cut edge of the board: darker, the flutes showing
    box(w, t, d, mat.cardboard, 0, t / 2, 0);
    for (const s of [-1, 1]) { box(w, h, t, mat.cardboard, 0, h / 2, s * (d / 2 - t / 2)); box(t, h, d - 2 * t, mat.cardboard, s * (w / 2 - t / 2), h / 2, 0); }
    // a flap: hinged on a wall's top edge. along: "x" for the long walls (near / far), "z" for the short ones. a = 0 shut, 90° upright, 180° flat outward, more = hanging down outside
    const flap = (along, s, a, drop = 0) => { const g = new THREE.Group(), wide = along === "x" ? w - 0.004 : d - 2 * t - 0.004;
      g.position.set(along === "x" ? 0 : s * (w / 2 - t / 2), h - drop, along === "x" ? s * (d / 2 - t / 2) : 0);
      if (along === "x") g.rotation.x = s * a; else g.rotation.z = -s * a;
      add(g); into(g, () => {
      if (along === "x") { box(wide, t, L, mat.cardboard, 0, 0, -s * L / 2); box(wide, t * 0.7, 0.002, edge, 0, 0, -s * L, { cast: false, noEdge: true }); }
      else { box(L, t, wide, mat.cardboard, -s * L / 2, 0, 0); box(0.002, t * 0.7, wide, edge, -s * L, 0, 0, { cast: false, noEdge: true }); }
      }); return g; };
    const shut = new THREE.Group(), open = new THREE.Group(); shut.userData.lid = true; open.userData.flap = true; add(shut, open);
    into(shut, () => { // the day it comes: the short flaps under, the long ones over them, one run of tape along the seam and down both ends
      for (const s of [-1, 1]) { flap("z", s, 0, t); flap("x", s, 0); }
      box(w + 0.002, 0.001, 0.05, mat.tape, 0, h + t / 2 + 0.0008, 0, { cast: false, noEdge: true });
      for (const k of [-1, 1]) box(0.001, 0.07, 0.05, mat.tape, k * (w / 2 + 0.0008), h - 0.035, 0, { cast: false, noEdge: true });
    });
    into(open, () => {
      const near = flap("x", 1, 4.25), far = flap("x", -1, 1.42), right = flap("z", 1, 1.78), left = flap("z", -1, 2.15); /* the near one hangs down its own wall; the one by the bed can only stand */
      for (const [g, s] of [[near, 1], [far, -1]]) into(g, () => box(w * 0.86, 0.001, 0.024, mat.tape, 0.01 * s, t / 2 + 0.0008, -s * (L - 0.012), { cast: false, noEdge: true })); // the tape, cut down the seam: half of it left on each long flap
      for (const k of [-1, 1]) box(0.001, 0.066, 0.05, mat.tape, k * (w / 2 + 0.0008), h - 0.04, 0.004 * k, { cast: false, noEdge: true, rx: 0.05 * k }); // and its ends, still on the walls
      for (const s of [-1, 1]) { box(w, 0.0025, 0.0025, edge, 0, h - 0.0005, s * (d / 2 - t / 2), { cast: false, noEdge: true }); box(0.0025, 0.0025, d - 2 * t, edge, s * (w / 2 - t / 2), h - 0.0005, 0, { cast: false, noEdge: true }); } // the crease where each flap turns
    });
    for (const s of [-1, 1]) box(0.002, 0.03, 0.09, mat.black, s * (w / 2 + 0.0002), h * 0.68, 0, { r: 0.0009, cast: false, noEdge: true }); // hand holes
    const label = face(160, 110, "#f4f3ee", (g) => { g.fillStyle = "#1c1c1c"; g.fillRect(8, 8, 60, 12); for (let i = 0; i < 26; i++) g.fillRect(10 + i * 5.4, 70, (i * 7) % 3 + 1, 30); for (let i = 0; i < 4; i++) g.fillRect(10, 28 + i * 9, 70 + ((i * 31) % 60), 3); g.strokeStyle = "#1c1c1c"; g.lineWidth = 2; g.strokeRect(3, 3, 154, 104); });
    box(0.11, 0.076, 0.0008, M({ map: label, roughness: 0.7 }), -0.1, h * 0.27, d / 2 + 0.0006, { cast: false, noEdge: true, rz: 0.03 }); // the carrier's label: bars and lines, no words
    const mark = face(96, 96, "rgba(0,0,0,0)", (g) => { g.clearRect(0, 0, 96, 96); g.fillStyle = "rgba(60,40,22,.75)"; for (const x of [30, 66]) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x - 14, 34); g.lineTo(x - 5, 34); g.lineTo(x - 5, 70); g.lineTo(x + 5, 70); g.lineTo(x + 5, 34); g.lineTo(x + 14, 34); g.fill(); } g.fillRect(12, 78, 72, 5); });
    box(0.07, 0.07, 0.0006, M({ map: mark, transparent: true, roughness: 0.9, depthWrite: false }), 0.12, h * 0.24, d / 2 + 0.0006, { cast: false, noEdge: true }); // this way up
    // Shut and taped on the day it comes; after that the flaps stand as they were left.
    return { onDay(day) { shut.visible = day === 1; open.visible = day > 1; } };
  },
};
