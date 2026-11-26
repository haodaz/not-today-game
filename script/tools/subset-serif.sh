#!/usr/bin/env bash
# The bundled Noto Serif SC subset (public/fonts/README.md): Regular and SemiBold, the characters in
# /tmp/nsc/chars.txt (node script/tools/serif-chars.mjs), as woff2. Run from the repository root.
# Source: Noto Serif SC 2.003 OTF in /tmp/nsc/SubsetOTF/SC/; fontTools (pyftsubset + brotli) in /tmp/ftvenv.
set -euo pipefail
for weight in Regular SemiBold; do
  /tmp/ftvenv/bin/pyftsubset "/tmp/nsc/SubsetOTF/SC/NotoSerifSC-${weight}.otf" \
    --text-file=/tmp/nsc/chars.txt \
    --flavor=woff2 \
    --layout-features='*' \
    --output-file="public/fonts/NotoSerifSC-${weight}.woff2"
done
