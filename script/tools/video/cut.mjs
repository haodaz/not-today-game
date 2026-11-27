// cut.mjs <edl.json> <out.mp4>: lays clips and black title cards end to end over the song.
// An entry is { src, ss, dur, speed?, zoom?: [x, y, w, h] (source pixels), fadeIn?, fadeOut?, note? }
// or { card: "line one\nline two", dur, size?, fadeIn?, fadeOut? }. `at` (seconds) on an entry is checked against the running clock.
import fs from "node:fs"; import { compArgs } from "./comp.mjs"; import { spawnSync } from "node:child_process"; import path from "node:path";
const [edlPath, out] = process.argv.slice(2); const edl = JSON.parse(fs.readFileSync(edlPath, "utf8"));
const FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", W = 1920, H = 1080, FPS = 30;
const FONT = edl.font || "/System/Library/Fonts/Supplemental/Georgia.ttf";
const tmp = fs.mkdtempSync(path.join(path.dirname(out), ".cut-")); const run = (args) => { const r = spawnSync(FF, ["-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] }); if (r.status !== 0) throw new Error("ffmpeg failed: " + args.join(" ").slice(0, 300)); };
// every part gets the same frame rate and track timescale: the concat below copies streams, and parts that differ there come out at the wrong speed (seen: 4:51 of clips played in 3:11)
const enc = ["-r", String(FPS), "-vsync", "cfr", "-video_track_timescale", "30000", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an"];
let clock = 0; const parts = []; const log = [];
edl.clips.forEach((c, i) => {
  if (c.at !== undefined && Math.abs(c.at - clock) > 0.05) log.push(`!! entry ${i} (${c.note || c.card || c.src}) wants ${c.at} s, the clock is at ${clock.toFixed(2)} s`);
  const f = path.join(tmp, `p${String(i).padStart(3, "0")}.mp4`); const fades = [c.fadeIn ? `fade=t=in:st=0:d=${c.fadeIn}` : null, c.fadeOut ? `fade=t=out:st=${(c.dur - c.fadeOut).toFixed(3)}:d=${c.fadeOut}` : null].filter(Boolean);
  if (c.card !== undefined) {
    const lines = c.card.split("\n"), size = c.size || 72, gap = Math.round(size * 1.5), top = Math.round(H / 2 - (lines.length * gap) / 2 + gap * 0.15);
    const draw = lines.map((l, k) => { const tf = path.join(tmp, `t${i}_${k}.txt`); fs.writeFileSync(tf, l); return `drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=0xEDE6D8:fontsize=${size}:x=(w-text_w)/2:y=${top + k * gap}`; });
    run(["-f", "lavfi", "-i", `color=c=0x050507:s=${W}x${H}:r=${FPS}:d=${c.dur}`, "-vf", [...(c.card ? draw : []), ...fades].join(",") || "null", "-t", String(c.dur), ...enc, f]);
  } else if (c.comp !== undefined) {
    run([...compArgs(c, i, { W, H, FPS, FONT, tmp, base: path.dirname(edlPath), fades }), "-t", String(c.dur), ...enc, f]);
  } else if (c.img !== undefined) {
    // a still: fitted on the dark ground, with a slow push-in (or none: zoomTo 1)
    const z = c.zoomTo ?? 1.06, n = Math.round(c.dur * FPS);
    const vf = [`scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos`, `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x050507`, `scale=${W * 2}:${H * 2}`, `zoompan=z=\x27min(1+${(z - 1).toFixed(4)}*on/${n},${z})\x27:x=\x27iw/2-(iw/zoom/2)\x27:y=\x27ih/2-(ih/zoom/2)\x27:d=${n}:s=${W}x${H}:fps=${FPS}`, ...fades].join(",");
    run(["-loop", "1", "-i", path.resolve(path.dirname(edlPath), c.img), "-vf", vf, "-t", String(c.dur), ...enc, f]);
  } else {
    let over = null; if (c.title) { const tt = c.title, tf = path.join(tmp, `o${i}.txt`); fs.writeFileSync(tf, tt.text); const A = tt.from, B = tt.to; over = `drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=0xEDE6D8:fontsize=${tt.size || 56}:shadowcolor=black@0.7:shadowx=0:shadowy=3:x=(w-text_w)/2:y=h*${tt.y || 0.8}:alpha='if(lt(t,${A}),0,if(lt(t,${A + 0.5}),(t-${A})/0.5,if(lt(t,${B - 0.5}),1,if(lt(t,${B}),(${B}-t)/0.5,0))))'`; }
    const sp = c.speed || 1, vf = [c.zoom ? `crop=${c.zoom[2]}:${c.zoom[3]}:${c.zoom[0]}:${c.zoom[1]}` : null, `scale=${W}:${H}:flags=lanczos`, sp !== 1 ? `setpts=PTS/${sp}` : null, `fps=${FPS}`, over, ...fades].filter(Boolean).join(",");
    run(["-ss", String(c.ss), "-t", String(c.dur * sp + 0.2), "-i", path.resolve(path.dirname(edlPath), c.src), "-vf", vf, "-t", String(c.dur), ...enc, f]);
  }
  // a source that runs out gives a short or empty part, and the copy-concat then drifts or stops: say so
  { const pr = spawnSync(FF, ["-hide_banner", "-i", f], { encoding: "utf8" }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/); const got = pr ? +pr[1] * 3600 + +pr[2] * 60 + +pr[3] : 0; if (Math.abs(got - c.dur) > 0.1) log.push(`!! entry ${i} (${c.note || c.src}) is ${got.toFixed(2)} s long, wanted ${c.dur} s: the source ends early`); }
  parts.push(f); log.push(`${clock.toFixed(2).padStart(7)}  +${String(c.dur).padEnd(5)} ${c.card !== undefined ? "[card] " + c.card.replace(/\n/g, " / ") : c.comp !== undefined ? "[comp] " + (c.comp.caption || "").replace(/\n/g, " / ") : c.img !== undefined ? "[still] " + c.img : c.src + " @" + c.ss}${c.note ? "  · " + c.note : ""}`); clock += c.dur;
});
const list = path.join(tmp, "list.txt"); fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
const audio = edl.audio ? ["-i", path.resolve(path.dirname(edlPath), edl.audio)] : [];
run(["-f", "concat", "-safe", "0", "-i", list, ...audio, "-c:v", "copy", ...(edl.audio ? ["-c:a", "aac", "-b:a", "256k", "-shortest"] : []), "-movflags", "+faststart", out]);
if (!process.env.KEEP) fs.rmSync(tmp, { recursive: true, force: true }); else console.log("kept", tmp); log.push(`total ${clock.toFixed(2)} s → ${out}`); fs.writeFileSync(out + ".log.txt", log.join("\n") + "\n"); console.log(log.filter((l) => l.startsWith("!!") || l.startsWith("total")).join("\n"));
