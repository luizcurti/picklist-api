#!/usr/bin/env bash
# Extracts the <svg>...</svg> block from docs/src/system-overview.html into
# a standalone docs/img/system-overview.svg. GitHub renders SVG directly in
# Markdown, so no rasterization step is needed. Source (.html, hand-edited)
# and extracted output (.svg) are kept separate, same convention as
# docs/mmd/*.mmd -> docs/img/*.png.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_FILE="$ROOT_DIR/docs/src/system-overview.html"
OUT_FILE="$ROOT_DIR/docs/img/system-overview.svg"

mkdir -p "$ROOT_DIR/docs/img"

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  sed -n '/<svg/,/<\/svg>/p' "$SRC_FILE"
} >"$OUT_FILE"

echo "Extracted docs/img/system-overview.svg from docs/src/system-overview.html"
