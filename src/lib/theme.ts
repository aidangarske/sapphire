import { invoke } from "@tauri-apps/api/core";

export interface Theme {
  id: string;
  name: string;
  light?: boolean;
  vars: Record<string, string>;
}

const TOKEN_KEYS = [
  "bg-0",
  "bg-1",
  "bg-2",
  "bg-3",
  "border",
  "text",
  "muted",
  "accent",
  "accent-hi",
  "accent-deep",
  "ok",
  "warn",
  "bad",
] as const;

export const THEMES: Theme[] = [
  {
    id: "sapphire",
    name: "Sapphire",
    vars: {
      "bg-0": "#0d1117",
      "bg-1": "#141a24",
      "bg-2": "#1c2433",
      "bg-3": "#273141",
      border: "#2b3647",
      text: "#eef2f8",
      muted: "#9aa6b8",
      accent: "#2f81f7",
      "accent-hi": "#5aa2ff",
      "accent-deep": "#1a5fd0",
      ok: "#3fb950",
      warn: "#d29922",
      bad: "#f85149",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    vars: {
      "bg-0": "#282a36",
      "bg-1": "#2d2f3d",
      "bg-2": "#343746",
      "bg-3": "#424458",
      border: "#44475a",
      text: "#f8f8f2",
      muted: "#9aa0b3",
      accent: "#bd93f9",
      "accent-hi": "#d6b6ff",
      "accent-deep": "#9a6df0",
      ok: "#50fa7b",
      warn: "#f1fa8c",
      bad: "#ff5555",
    },
  },
  {
    id: "nord",
    name: "Nord",
    vars: {
      "bg-0": "#2e3440",
      "bg-1": "#313846",
      "bg-2": "#3b4252",
      "bg-3": "#434c5e",
      border: "#4c566a",
      text: "#eceff4",
      muted: "#9aa6bd",
      accent: "#88c0d0",
      "accent-hi": "#a3d4e0",
      "accent-deep": "#5e81ac",
      ok: "#a3be8c",
      warn: "#ebcb8b",
      bad: "#bf616a",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    vars: {
      "bg-0": "#1a1b26",
      "bg-1": "#1e2030",
      "bg-2": "#24283b",
      "bg-3": "#2f334d",
      border: "#3b3f5c",
      text: "#c0caf5",
      muted: "#7882ac",
      accent: "#7aa2f7",
      "accent-hi": "#9ec0ff",
      "accent-deep": "#5a7fd6",
      ok: "#9ece6a",
      warn: "#e0af68",
      bad: "#f7768e",
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox Dark",
    vars: {
      "bg-0": "#1d2021",
      "bg-1": "#282828",
      "bg-2": "#32302f",
      "bg-3": "#3c3836",
      border: "#504945",
      text: "#ebdbb2",
      muted: "#a89984",
      accent: "#fabd2f",
      "accent-hi": "#ffd866",
      "accent-deep": "#d79921",
      ok: "#b8bb26",
      warn: "#fe8019",
      bad: "#fb4934",
    },
  },
  {
    id: "one-dark",
    name: "One Dark",
    vars: {
      "bg-0": "#21252b",
      "bg-1": "#282c34",
      "bg-2": "#2c313a",
      "bg-3": "#3b4048",
      border: "#3e4451",
      text: "#d7dae0",
      muted: "#828997",
      accent: "#61afef",
      "accent-hi": "#84c5ff",
      "accent-deep": "#4d8fd6",
      ok: "#98c379",
      warn: "#e5c07b",
      bad: "#e06c75",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    vars: {
      "bg-0": "#1e1e2e",
      "bg-1": "#232336",
      "bg-2": "#292c3c",
      "bg-3": "#313244",
      border: "#45475a",
      text: "#cdd6f4",
      muted: "#a6adc8",
      accent: "#cba6f7",
      "accent-hi": "#ddbdff",
      "accent-deep": "#a98fe0",
      ok: "#a6e3a1",
      warn: "#f9e2af",
      bad: "#f38ba8",
    },
  },
  {
    id: "monokai",
    name: "Monokai Pro",
    vars: {
      "bg-0": "#221f22",
      "bg-1": "#2a272a",
      "bg-2": "#322f32",
      "bg-3": "#3a373a",
      border: "#4a474a",
      text: "#fcfcfa",
      muted: "#939293",
      accent: "#ffd866",
      "accent-hi": "#ffe89a",
      "accent-deep": "#e0b84a",
      ok: "#a9dc76",
      warn: "#fc9867",
      bad: "#ff6188",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    vars: {
      "bg-0": "#002b36",
      "bg-1": "#073642",
      "bg-2": "#0a3d49",
      "bg-3": "#0f4a58",
      border: "#14515f",
      text: "#eee8d5",
      muted: "#93a1a1",
      accent: "#268bd2",
      "accent-hi": "#4fa8e6",
      "accent-deep": "#1f6f9f",
      ok: "#859900",
      warn: "#b58900",
      bad: "#dc322f",
    },
  },
  {
    id: "github-light",
    name: "GitHub Light",
    light: true,
    vars: {
      "bg-0": "#ffffff",
      "bg-1": "#f6f8fa",
      "bg-2": "#eef1f4",
      "bg-3": "#e3e8ee",
      border: "#d0d7de",
      text: "#1f2328",
      muted: "#636c76",
      accent: "#0969da",
      "accent-hi": "#218bff",
      "accent-deep": "#0a4ea8",
      ok: "#1a7f37",
      warn: "#9a6700",
      bad: "#cf222e",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    light: true,
    vars: {
      "bg-0": "#fdf6e3",
      "bg-1": "#f4edda",
      "bg-2": "#eee8d5",
      "bg-3": "#e3ddc8",
      border: "#d6cfb8",
      text: "#073642",
      muted: "#657b83",
      accent: "#268bd2",
      "accent-hi": "#1f6f9f",
      "accent-deep": "#1a5f88",
      ok: "#859900",
      warn: "#b58900",
      bad: "#dc322f",
    },
  },
];

const THEME_KEY = "sapphire.theme";

export function getThemeId(): string {
  return localStorage.getItem(THEME_KEY) ?? THEMES[0].id;
}

const DOCK_ICONS = import.meta.glob("../assets/dock-icons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function dockIconUrl(id: string): string | undefined {
  const hit = Object.entries(DOCK_ICONS).find(([path]) => path.endsWith(`/${id}.png`));
  return hit?.[1];
}

export async function applyDockIcon(id = getThemeId()) {
  const url = dockIconUrl(id) ?? dockIconUrl(THEMES[0].id);
  if (!url) return;
  try {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    await invoke("set_dock_icon", { png: Array.from(bytes) });
  } catch {
    /* not running under Tauri, or command unavailable — ignore */
  }
}

export function setThemeId(id: string) {
  localStorage.setItem(THEME_KEY, id);
  applyTheme(id);
  applyDockIcon(id);
}

const NOTE_TEXT_KEY = "sapphire.noteText";

export const NOTE_TEXT_CHOICES: { id: string; label: string; value: string }[] = [
  { id: "default", label: "Theme", value: "" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "warm", label: "Warm", value: "#f3eee4" },
  { id: "soft", label: "Soft", value: "#c9d3e2" },
];

export const getNoteText = (): string => localStorage.getItem(NOTE_TEXT_KEY) ?? "";

export function setNoteText(value: string) {
  localStorage.setItem(NOTE_TEXT_KEY, value);
  applyNoteText(value);
}

export function applyNoteText(value = getNoteText()) {
  const root = document.documentElement;
  if (value) root.style.setProperty("--note-text", value);
  else root.style.removeProperty("--note-text");
}

export function applyTheme(id = getThemeId()) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  for (const key of TOKEN_KEYS) {
    const value = theme.vars[key];
    if (value) root.style.setProperty(`--${key}`, value);
  }
  root.classList.toggle("theme-light", !!theme.light);
}

export type Layout = "vertical" | "horizontal";

const MAIN_KEY = "sapphire.layout";
const LIST_KEY = "sapphire.listLayout";

function readLayout(key: string): Layout {
  return localStorage.getItem(key) === "horizontal" ? "horizontal" : "vertical";
}

export const getMainLayout = (): Layout => readLayout(MAIN_KEY);
export const getListLayout = (): Layout => readLayout(LIST_KEY);

export function setMainLayout(layout: Layout) {
  localStorage.setItem(MAIN_KEY, layout);
  window.dispatchEvent(new CustomEvent("sapphire:layout"));
}

export function setListLayout(layout: Layout) {
  localStorage.setItem(LIST_KEY, layout);
  window.dispatchEvent(new CustomEvent("sapphire:layout"));
}
