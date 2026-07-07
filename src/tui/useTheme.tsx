import React, { createContext, useContext } from "react";
import { getTheme, type ThemeTokens } from "./theme.ts";

const ThemeContext = createContext<ThemeTokens>(getTheme("sapphire").tokens);

export function ThemeProvider({ id, children }: { id: string; children: React.ReactNode }) {
  return <ThemeContext.Provider value={getTheme(id).tokens}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
