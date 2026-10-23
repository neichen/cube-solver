#!/usr/bin/env bash
# Rebuild vendor/gullicube/ (gullicube.js + gullicube.wasm + data/*.cls) from the upstream source.
# gullicube by Tomas Rokicki, https://github.com/rokicki/gullicube, used under the MPL-2.0 option of
# "MPL-2.0 OR GPL-3.0-or-later". The files in vendor/gullicube/ are unmodified upstream output; see NOTICE.md.
# Needs git and Emscripten (em++; the shipped build used Emscripten 6.0.13).
# Usage: tools/build-gullicube.sh [work-dir]
set -euo pipefail
COMMIT=48bd54b36a95888639f63df63a24d8639b84cd23
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$(mktemp -d)}"
OUT="$ROOT/vendor/gullicube"
if [ ! -d "$WORK/gullicube/.git" ]; then git clone https://github.com/rokicki/gullicube.git "$WORK/gullicube"; fi
cd "$WORK/gullicube" && git fetch -q origin && git checkout -q "$COMMIT"
command -v em++ >/dev/null || { echo "em++ not found: install and activate the Emscripten SDK first" >&2; exit 1; }
em++ -O3 -pthread src/full/*.cpp src/brob/*.cpp \
  -sPROXY_TO_PTHREAD -sALLOW_MEMORY_GROWTH -sMAXIMUM_MEMORY=4GB -sINITIAL_MEMORY=128MB \
  -sMODULARIZE -sEXPORT_NAME=Gullicube -sINVOKE_RUN=0 -sEXIT_RUNTIME=1 \
  -sEXPORTED_RUNTIME_METHODS=callMain,FS,ENV -sENVIRONMENT=worker,node \
  -sSTACK_SIZE=8MB -sDEFAULT_PTHREAD_STACK_SIZE=2MB -sPTHREAD_POOL_SIZE=0 \
  -o "$OUT/gullicube.js"
# the table files the solver loads (unmodified copies of upstream data/)
mkdir -p "$OUT/data"
for f in c12x diag2 diag3 diag_x10 eg8 fast6 mid2 mid3 mid_x10 p8s10 p9 pair3 wing3 wing_d6c; do
  cp "data/$f.cls" "$OUT/data/"
done
echo "gullicube rebuilt from $COMMIT into $OUT (run: npm run test:nxn)"
