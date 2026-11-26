Game-layer fonts (the computer UI keeps system fonts on purpose).

- BarlowCondensed-Bold.woff2 — Barlow Condensed 700, OFL (Jeremy Tribby). Title and stage numbers. Latin subset.
- LXGWWenKai-Regular.woff2 — 霞鹜文楷, OFL (LXGW), v1.510. Chinese game text. Subset to GB2312 + every character in content/ and the gamebook (7036 glyphs, 1.6 MB); rare glyphs fall back to Noto Sans SC / system.
- Alegreya-Regular/Bold.woff2 — Alegreya, OFL (Huerta Tipográfica). English dialogue and credits. Latin subset.
- AlegreyaSans-Regular/Medium.woff2 — Alegreya Sans, OFL. English chips and menus. Latin subset.

Subset with fontTools pyftsubset (see script/notes/v5.1-待办.md, 2026-11-01).
- NotoSerifSC-Regular/SemiBold.woff2 — Noto Serif SC 400 and 600, SIL Open Font License 1.1 (Google / Adobe; the OFL text is in the release zip's LICENSE). Version 2.003 (`Version 2.003;hotconv 1.1.1;makeotfexe 2.6.0`), from the official notofonts release Serif2.003 (2024-07-30): https://github.com/notofonts/noto-cjk/releases/download/Serif2.003/14_NotoSerifSC.zip (files SubsetOTF/SC/NotoSerifSC-Regular.otf and -SemiBold.otf). CSS family "NT Song": the game menu, the task card and the title page (`--gm-serif`). Subset to every character in content/strings/zh.json and en.json, every checklist line (`items[].text` and `rewrite`) in content/days/*.json and content/days/en/*.json, the digits, Latin letters, a space and · … 「」（）：，。？！ (1073 glyphs mapped; ↻ is not in the font and falls back). About 300 KB each.
  To rerun when strings or checklist lines change (fontTools with brotli, e.g. `python3 -m venv /tmp/ftvenv && /tmp/ftvenv/bin/pip install fonttools brotli`; the OTFs unzipped to /tmp/nsc):
  `node script/tools/serif-chars.mjs` (writes /tmp/nsc/chars.txt), then `bash script/tools/subset-serif.sh`, which runs for each weight:
  `/tmp/ftvenv/bin/pyftsubset /tmp/nsc/SubsetOTF/SC/NotoSerifSC-<Weight>.otf --text-file=/tmp/nsc/chars.txt --flavor=woff2 --layout-features='*' --output-file=public/fonts/NotoSerifSC-<Weight>.woff2`
  Check what a subset maps: `node script/tools/woff2-cmap.mjs public/fonts/NotoSerifSC-Regular.woff2` (tests/fonts.test.ts checks the menu's strings and the checklist lines against it).
