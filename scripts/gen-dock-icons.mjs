import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "assets", "dock-icons");
mkdirSync(outDir, { recursive: true });

// id -> [bg0, accent, accentHi, accentDeep]; kept in sync with src/lib/theme.ts
const THEMES = {
  sapphire: ["#0d1117", "#2f81f7", "#5aa2ff", "#1a5fd0"],
  dracula: ["#282a36", "#bd93f9", "#d6b6ff", "#9a6df0"],
  nord: ["#2e3440", "#88c0d0", "#a3d4e0", "#5e81ac"],
  "tokyo-night": ["#1a1b26", "#7aa2f7", "#9ec0ff", "#5a7fd6"],
  gruvbox: ["#1d2021", "#fabd2f", "#ffd866", "#d79921"],
  "one-dark": ["#21252b", "#61afef", "#84c5ff", "#4d8fd6"],
  catppuccin: ["#1e1e2e", "#cba6f7", "#ddbdff", "#a98fe0"],
  monokai: ["#221f22", "#ffd866", "#ffe89a", "#e0b84a"],
  "solarized-dark": ["#002b36", "#268bd2", "#4fa8e6", "#1f6f9f"],
  "github-light": ["#ffffff", "#0969da", "#218bff", "#0a4ea8"],
  "solarized-light": ["#fdf6e3", "#268bd2", "#1f6f9f", "#1a5f88"],
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, "0")).join("")}`;
}

// Same composition as build/app-icon.svg — only the colors change per theme.
// The gem facets use a light->dark ramp derived from the accent so every skin
// gets a properly beveled gem (independent of the theme's UI hi/deep tuning).
function svg(bg0, accent) {
  const bgTop = bg0;
  const bgBot = shade(bg0, 0.7);
  const hi = shade(accent, 1.35);
  const lo = shade(accent, 0.6);
  const mid = shade(accent, 0.82);
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bgTop}"/>
      <stop offset="1" stop-color="${bgBot}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.46" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <clipPath id="tile">
      <rect x="104" y="104" width="816" height="816" rx="182"/>
    </clipPath>
  </defs>

  <rect x="104" y="104" width="816" height="816" rx="182" fill="url(#bg)"/>

  <g clip-path="url(#tile)">
    <circle cx="512" cy="500" r="300" fill="url(#glow)"/>
    <g filter="url(#soft)" opacity="0.8">
      <path d="M360 300 L664 300 L754 455 L512 760 L270 455 Z" fill="${accent}"/>
    </g>
    <g stroke="#0a1830" stroke-width="4" stroke-linejoin="round">
      <path d="M360 300 L512 300 L512 455 L270 455 Z" fill="${accent}"/>
      <path d="M512 300 L664 300 L754 455 L512 455 Z" fill="${hi}"/>
      <path d="M270 455 L512 455 L512 760 Z" fill="${lo}"/>
      <path d="M512 455 L754 455 L512 760 Z" fill="${mid}"/>
      <path d="M360 300 L664 300 L612 343 L412 343 Z" fill="${hi}" opacity="0.9"/>
      <path d="M512 300 L512 760" stroke="${hi}" stroke-width="5" opacity="0.5"/>
    </g>
  </g>
</svg>`;
}

for (const [id, [bg, accent]] of Object.entries(THEMES)) {
  const out = join(outDir, `${id}.png`);
  await sharp(Buffer.from(svg(bg, accent))).png().toFile(out);
  console.log("wrote", out);
}
