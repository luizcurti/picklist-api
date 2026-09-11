#!/usr/bin/env bash
# Renders every Mermaid source in docs/mmd/*.mmd into a PNG in docs/img/.
# Source (.mmd) and rendered output (.png) are kept in separate folders so
# the diagrams can be regenerated on demand instead of hand-edited.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MMD_DIR="$ROOT_DIR/docs/mmd"
IMG_DIR="$ROOT_DIR/docs/img"

mkdir -p "$IMG_DIR"

for mmd_file in "$MMD_DIR"/*.mmd; do
  name="$(basename "$mmd_file" .mmd)"
  echo "Rendering $name.mmd -> docs/img/$name.png"
  npx -y @mermaid-js/mermaid-cli \
    -i "$mmd_file" \
    -o "$IMG_DIR/$name.png" \
    -b white \
    -s 2
done

echo "Done. Rendered diagrams are in docs/img/."
