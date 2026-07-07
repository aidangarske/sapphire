export interface ThemeTokens {
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentHi: string;
  accentDeep: string;
  ok: string;
  warn: string;
  bad: string;
}

export interface Theme {
  id: string;
  name: string;
  light?: boolean;
  tokens: ThemeTokens;
}

const t = (
  bg0: string,
  bg1: string,
  bg2: string,
  bg3: string,
  border: string,
  text: string,
  muted: string,
  accent: string,
  accentHi: string,
  accentDeep: string,
  ok: string,
  warn: string,
  bad: string,
): ThemeTokens => ({ bg0, bg1, bg2, bg3, border, text, muted, accent, accentHi, accentDeep, ok, warn, bad });

export const THEMES: Theme[] = [
  { id: "sapphire", name: "Sapphire", tokens: t("#0d1117", "#141a24", "#1c2433", "#273141", "#2b3647", "#eef2f8", "#9aa6b8", "#2f81f7", "#5aa2ff", "#1a5fd0", "#3fb950", "#d29922", "#f85149") },
  { id: "dracula", name: "Dracula", tokens: t("#282a36", "#2d2f3d", "#343746", "#424458", "#44475a", "#f8f8f2", "#9aa0b3", "#bd93f9", "#d6b6ff", "#9a6df0", "#50fa7b", "#f1fa8c", "#ff5555") },
  { id: "nord", name: "Nord", tokens: t("#2e3440", "#313846", "#3b4252", "#434c5e", "#4c566a", "#eceff4", "#9aa6bd", "#88c0d0", "#a3d4e0", "#5e81ac", "#a3be8c", "#ebcb8b", "#bf616a") },
  { id: "tokyo-night", name: "Tokyo Night", tokens: t("#1a1b26", "#1e2030", "#24283b", "#2f334d", "#3b3f5c", "#c0caf5", "#7882ac", "#7aa2f7", "#9ec0ff", "#5a7fd6", "#9ece6a", "#e0af68", "#f7768e") },
  { id: "gruvbox", name: "Gruvbox Dark", tokens: t("#1d2021", "#282828", "#32302f", "#3c3836", "#504945", "#ebdbb2", "#a89984", "#fabd2f", "#ffd866", "#d79921", "#b8bb26", "#fe8019", "#fb4934") },
  { id: "one-dark", name: "One Dark", tokens: t("#21252b", "#282c34", "#2c313a", "#3b4048", "#3e4451", "#d7dae0", "#828997", "#61afef", "#84c5ff", "#4d8fd6", "#98c379", "#e5c07b", "#e06c75") },
  { id: "catppuccin", name: "Catppuccin Mocha", tokens: t("#1e1e2e", "#232336", "#292c3c", "#313244", "#45475a", "#cdd6f4", "#a6adc8", "#cba6f7", "#ddbdff", "#a98fe0", "#a6e3a1", "#f9e2af", "#f38ba8") },
  { id: "monokai", name: "Monokai Pro", tokens: t("#221f22", "#2a272a", "#322f32", "#3a373a", "#4a474a", "#fcfcfa", "#939293", "#ffd866", "#ffe89a", "#e0b84a", "#a9dc76", "#fc9867", "#ff6188") },
  { id: "solarized-dark", name: "Solarized Dark", tokens: t("#002b36", "#073642", "#0a3d49", "#0f4a58", "#14515f", "#eee8d5", "#93a1a1", "#268bd2", "#4fa8e6", "#1f6f9f", "#859900", "#b58900", "#dc322f") },
  { id: "github-light", name: "GitHub Light", light: true, tokens: t("#ffffff", "#f6f8fa", "#eef1f4", "#e3e8ee", "#d0d7de", "#1f2328", "#636c76", "#0969da", "#218bff", "#0a4ea8", "#1a7f37", "#9a6700", "#cf222e") },
  { id: "solarized-light", name: "Solarized Light", light: true, tokens: t("#fdf6e3", "#f4edda", "#eee8d5", "#e3ddc8", "#d6cfb8", "#073642", "#657b83", "#268bd2", "#1f6f9f", "#1a5f88", "#859900", "#b58900", "#dc322f") },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
