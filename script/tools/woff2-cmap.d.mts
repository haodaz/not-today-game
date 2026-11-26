/** The woff2's tables, decompressed: tag → bytes. */
export function woff2Tables(buf: Uint8Array): Map<string, Buffer>;
/** The code points a cmap table maps to a glyph (its Unicode subtables, formats 4 and 12). */
export function cmapCodepoints(cmap: Buffer): Set<number>;
/** The code points a woff2 font maps (its cmap). */
export function woff2Codepoints(buf: Uint8Array): Set<number>;
