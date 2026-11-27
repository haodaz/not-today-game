// A composed shot for cut.mjs: a ground (a picture pushed in slowly, a clip, or the dark), cut-out pictures laid over it
// that appear and can leave, and a written caption.
// { comp: { bg?, bgSrc?: {src, ss, zoom?, speed?}, cy?, dim?, sat?, push?, layers?: [{ img, h, x, y, at?, out?, rise?, drift?: [from, px up, seconds] }], caption?, capAt?, capSize?, capY? }, dur }
import fs from "node:fs"; import path from "node:path";
export function compArgs(c, i, { W, H, FPS, FONT, tmp, base, fades }) {
  const k = c.comp, n = Math.round(c.dur * FPS), ins = [], fc = [], R = (p) => path.resolve(base, p);
  if (k.bg) {
    const z = k.push ?? 1.07; ins.push("-loop", "1", "-framerate", String(FPS), "-t", String(c.dur + 0.2), "-i", R(k.bg));
    fc.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})/2:(ih-${H})*${k.cy ?? 0.5},eq=brightness=${-(k.dim ?? 0)}:saturation=${k.sat ?? 1},scale=${W * 2}:${H * 2},zoompan=z='min(1+${(z - 1).toFixed(4)}*on/${n},${z})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}[b0]`);
  } else if (k.bgSrc) {
    const zz = k.bgSrc.zoom, sp = k.bgSrc.speed || 1; ins.push("-ss", String(k.bgSrc.ss), "-t", String(c.dur * sp + 0.3), "-i", R(k.bgSrc.src));
    fc.push(`[0:v]${zz ? `crop=${zz[2]}:${zz[3]}:${zz[0]}:${zz[1]},` : ""}scale=${W}:${H}:flags=lanczos,${sp !== 1 ? `setpts=PTS/${sp},` : ""}fps=${FPS},eq=brightness=${-(k.dim ?? 0)}[b0]`);
  } else { ins.push("-f", "lavfi", "-t", String(c.dur + 0.2), "-i", `color=c=0x050507:s=${W}x${H}:r=${FPS}`); fc.push("[0:v]null[b0]"); }
  (k.layers || []).forEach((L, j) => {
    const still = L.at === undefined, at = L.at ?? 0, rise = still ? 0 : L.rise ?? 22; ins.push("-loop", "1", "-framerate", String(FPS), "-t", String(c.dur + 0.2), "-i", R(L.img));
    fc.push(`[${j + 1}:v]format=rgba,scale=-1:${L.h}:flags=lanczos${still ? "" : `,fade=t=in:st=${at}:d=0.4:alpha=1`}${L.out !== undefined ? `,fade=t=out:st=${L.out}:d=0.5:alpha=1` : ""}[l${j}]`);
    fc.push(`[b${j}][l${j}]overlay=x='${L.x}-w/2':y='${L.y}-h/2+${rise}*max(0,1-(t-${at})/0.45)${L.drift ? `-${L.drift[1]}*min(1,max(0,(t-${L.drift[0]})/${L.drift[2] ?? 0.9}))` : ""}':eval=frame[b${j + 1}]`);
  });
  let last = `b${(k.layers || []).length}`;
  if (k.caption) {
    const lines = k.caption.split("\n"), size = k.capSize || 54, gap = Math.round(size * 1.4), [A, B] = k.capAt || [-2, c.dur + 2], y0 = Math.round(H * (k.capY ?? 0.86) - ((lines.length - 1) * gap) / 2);
    const al = `if(lt(t,${A}),0,if(lt(t,${A + 0.5}),(t-${A})/0.5,if(lt(t,${B - 0.4}),1,if(lt(t,${B}),(${B}-t)/0.4,0))))`;
    // a soft shade under a caption that sits on a picture, in two steps so its top edge does not read as a bar
    if ((k.bg || k.bgSrc) && k.capShade !== false) { const top = (k.capY ?? 0.86) - 0.1 - (lines.length - 1) * 0.03; fc.push(`[${last}]drawbox=x=0:y=ih*${top.toFixed(3)}:w=iw:h=ih*${(1 - top).toFixed(3)}:color=black@0.22:t=fill,drawbox=x=0:y=ih*${(top + 0.045).toFixed(3)}:w=iw:h=ih*${(1 - top - 0.045).toFixed(3)}:color=black@0.25:t=fill[sh]`); last = "sh"; }
    lines.forEach((l, j) => { const tf = path.join(tmp, `c${i}_${j}.txt`); fs.writeFileSync(tf, l);
      fc.push(`[${last}]drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=0xF3EDE0:fontsize=${size}:shadowcolor=black@0.85:shadowx=0:shadowy=3:borderw=2:bordercolor=black@0.55:${(k.bg || k.bgSrc) && k.capBox !== false ? "" : ""}x=(w-text_w)/2:y=${y0 + j * gap}:alpha='${al}'[t${j}]`); last = `t${j}`; });
  }
  fc.push(`[${last}]${["format=yuv420p", ...fades].join(",")}[out]`);
  return [...ins, "-filter_complex", fc.join(";"), "-map", "[out]"];
}
