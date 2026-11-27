#!/bin/sh
# sheet.sh <video> <out.jpg> <cols> t1 t2 ... : labelled frames tiled into one picture
F=/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg
V="$1"; O="$2"; C="$3"; shift 3; D="$(mktemp -d)"; i=0
for t in "$@"; do i=$((i+1)); "$F" -loglevel error -y -ss "$t" -i "$V" -frames:v 1 -vf "scale=640:-1,drawtext=text='${t}s':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6:fontfile=/System/Library/Fonts/Helvetica.ttc" "$D/$(printf %03d $i).jpg"; done
R=$(( (i + C - 1) / C )); "$F" -loglevel error -y -pattern_type glob -i "$D/*.jpg" -vf "tile=${C}x${R}" -q:v 5 "$O"; rm -rf "$D"; echo "$O ($i frames)"
