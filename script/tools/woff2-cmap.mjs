// A small WOFF2 cmap reader (no dependency: Node's built-in brotli). Which code points a woff2 font
// maps to a glyph — the bundled Noto Serif SC subset's check (tests/fonts.test.ts). WOFF2 (W3C):
// a 48-byte header, a table directory (flags, an optional tag, UIntBase128 lengths), then one brotli
// stream holding every table back to back. cmap is never transformed; formats 4 and 12 are read.
// CLI: node script/tools/woff2-cmap.mjs <font.woff2> → the number of mapped code points.
import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";

const KNOWN_TAGS = "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill"
  .match(/.{4}\s?/g)
  .map((s) => s.slice(0, 4));

/** The woff2's tables, decompressed: tag → bytes. */
export function woff2Tables(buf) {
  const data = Buffer.from(buf);
  if (data.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a woff2 file");
  const numTables = data.readUInt16BE(12);
  const compressedSize = data.readUInt32BE(20);
  let p = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = data[p++];
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error("bad UIntBase128");
  };
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = data[p++];
    let tag;
    if ((flags & 0x3f) === 0x3f) {
      tag = data.toString("latin1", p, p + 4);
      p += 4;
    } else tag = KNOWN_TAGS[flags & 0x3f];
    const version = (flags >> 6) & 3;
    const origLength = base128();
    // a transformLength follows for transformed tables: glyf / loca at version 0, hmtx at version 1
    const transformed = ((tag === "glyf" || tag === "loca") && version === 0) || (tag === "hmtx" && version === 1);
    const length = transformed ? base128() : origLength;
    dir.push({ tag, length });
  }
  if (data.toString("latin1", 4, 8) === "ttcf") throw new Error("woff2 collections are not read here");
  const stream = brotliDecompressSync(data.subarray(p, p + compressedSize));
  const tables = new Map();
  let at = 0;
  for (const t of dir) {
    tables.set(t.tag, stream.subarray(at, at + t.length));
    at += t.length;
  }
  return tables;
}

/** The code points a cmap table maps to a glyph (its Unicode subtables, formats 4 and 12). */
export function cmapCodepoints(cmap) {
  const out = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const offset = cmap.readUInt32BE(8 + i * 8);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const format = cmap.readUInt16BE(offset);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(offset + 6);
      const ends = offset + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2; s += 2) {
        const end = cmap.readUInt16BE(ends + s);
        const start = cmap.readUInt16BE(starts + s);
        const delta = cmap.readInt16BE(deltas + s);
        const range = cmap.readUInt16BE(ranges + s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (range === 0) g = (c + delta) & 0xffff;
          else {
            g = cmap.readUInt16BE(ranges + s + range + 2 * (c - start));
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12);
      for (let k = 0; k < groups; k++) {
        const g = offset + 16 + k * 12;
        const start = cmap.readUInt32BE(g);
        const end = cmap.readUInt32BE(g + 4);
        const glyph = cmap.readUInt32BE(g + 8);
        for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) out.add(c);
      }
    }
  }
  return out;
}

/** The code points a woff2 font maps (its cmap). */
export function woff2Codepoints(buf) {
  const cmap = woff2Tables(buf).get("cmap");
  if (!cmap) throw new Error("no cmap table");
  return cmapCodepoints(cmap);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node script/tools/woff2-cmap.mjs <font.woff2>");
    process.exit(1);
  }
  console.log(`${woff2Codepoints(readFileSync(file)).size} code points mapped in ${file}`);
}
