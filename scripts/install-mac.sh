#!/usr/bin/env bash
# Sapphire — one-command macOS install.
# Installs prerequisites if missing, builds Sapphire.app, and copies it to /Applications.
set -euo pipefail

say() { printf "\n\033[1;34m==>\033[0m %s\n" "$1"; }

# 1. Xcode Command Line Tools (clang) — required by Tauri
if ! xcode-select -p >/dev/null 2>&1; then
  say "Installing Xcode Command Line Tools (accept the dialog)…"
  xcode-select --install || true
  echo "Finish the Command Line Tools install, then re-run this script."
  exit 1
fi

# 2. Rust
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
if ! command -v cargo >/dev/null 2>&1; then
  say "Installing Rust (rustup)…"
  tmp=$(mktemp)
  curl --proto '=https' --tlsv1.2 -fsSL -o "$tmp" https://sh.rustup.rs
  sh "$tmp" -y --no-modify-path
  rm -f "$tmp"
  . "$HOME/.cargo/env"
fi

# 3. Node 18+ (use existing; otherwise install LTS via nvm)
NVM_VERSION="v0.40.3"
NVM_SHA256="2d8359a64a3cb07c02389ad88ceecd43f2fa469c06104f92f98df5b6f315275f"
node_major() { node -p 'parseInt(process.versions.node.split(".")[0],10)' 2>/dev/null || echo 0; }
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 18 ]; then
  say "Installing Node LTS via nvm…"
  tmp=$(mktemp)
  curl --proto '=https' --tlsv1.2 -fsSL -o "$tmp" \
    "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh"
  echo "${NVM_SHA256}  ${tmp}" | shasum -a 256 -c -
  bash "$tmp"
  rm -f "$tmp"
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
fi

cd "$(dirname "$0")/.."

say "Installing dependencies…"
npm install

say "Building Sapphire.app (a few minutes the first time)…"
npm run tauri build

APP=$(find src-tauri/target/release/bundle/macos -maxdepth 1 -name "*.app" | head -1)
if [ -z "$APP" ]; then
  echo "Build failed — no .app was produced." >&2
  exit 1
fi
name=$(basename "$APP")
rm -rf "/Applications/$name"
cp -R "$APP" /Applications/

say "Installed: /Applications/$name"
echo "First launch: right-click Sapphire in Applications → Open (it's unsigned)."
echo "Optional: run 'gh auth login' for the PR tab; see Docs/CALENDAR-SETUP.md for Calendar."
