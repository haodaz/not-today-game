// The waste bin in the corner by the window wall. Furniture: reads no fact (docs/room-readout.md).
export default {
  id: "bin",
  slot: "bin",
  float: 0.25,
  build({ THREE, M, mat, lathe, ball }) {
    lathe([[0.0, 0.004], [0.1, 0.004], [0.125, 0.27], [0.12, 0.27], [0.097, 0.012], [0, 0.012]], M({ color: 0x55585c, roughness: 0.5, side: THREE.DoubleSide }), 0, 0, 0);
    ball(0.05, mat.sheet, 0.02, 0.08, 0.01, { s: [1, 0.7, 1.1] });
    ball(0.04, mat.sheet, -0.04, 0.07, -0.03, { s: [1.1, 0.8, 0.9] });
  },
};
