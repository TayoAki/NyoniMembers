import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palettes, type ColourScheme, type Palette } from "./theme";

type ThemeValue = { scheme: ColourScheme; colours: Palette };

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Dark is the house default, so an unknown system preference resolves to dark rather than light.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme: ColourScheme = system === "light" ? "light" : "dark";
  const value = useMemo<ThemeValue>(() => ({ scheme, colours: palettes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider.");
  return value;
}

export function useColours(): Palette {
  return useTheme().colours;
}
