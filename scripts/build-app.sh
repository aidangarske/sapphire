#!/usr/bin/env bash
# Build Sapphire.app (and .dmg). Pass --install to also copy it into /Applications.
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

cd "$(dirname "$0")/.."

npm install
npm run tauri build

APP=$(find src-tauri/target/release/bundle/macos -maxdepth 1 -name "*.app" | head -1)
DMG=$(find src-tauri/target/release/bundle/dmg -maxdepth 1 -name "*.dmg" 2>/dev/null | head -1)

echo ""
echo "Built: $APP"
[ -n "${DMG:-}" ] && echo "DMG:   $DMG"

if [ "${1:-}" = "--install" ] && [ -n "$APP" ]; then
  name=$(basename "$APP")
  rm -rf "/Applications/$name"
  cp -R "$APP" /Applications/
  echo "Installed: /Applications/$name"
  echo "(First launch: right-click the app -> Open, since it's unsigned.)"
fi
