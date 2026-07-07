#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p dist

targets=(
  "bun-darwin-arm64:sapphire-macos-arm64"
  "bun-darwin-x64:sapphire-macos-x64"
  "bun-linux-x64:sapphire-linux-x64"
  "bun-linux-arm64:sapphire-linux-arm64"
  "bun-windows-x64:sapphire-windows-x64.exe"
)

for entry in "${targets[@]}"; do
  target="${entry%%:*}"
  out="dist/${entry##*:}"
  echo "building $out ($target)"
  bun build src/index.ts --compile --target="$target" --outfile "$out"
done

echo "done:"
ls -lh dist/
