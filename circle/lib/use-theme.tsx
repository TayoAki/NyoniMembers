import { createContext, useContext, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { chrome, surfaces, type Surface, type SurfaceTone } from "./theme";

/**
 * The app is not light-or-dark by system preference. It is an ivory app with ink chrome and one
 * dark page, so a component asks which surface it is sitting on rather than which theme is active.
 * `Surface` sets that for its subtree; the header, the navigation and the membership page set it
 * to dark, everything else inherits light.
 */
const SurfaceContext = createContext<SurfaceTone>("light");

export function SurfaceProvider({ tone, children }: { tone: SurfaceTone; children: ReactNode }) {
  return <SurfaceContext.Provider value={tone}>{children}</SurfaceContext.Provider>;
}

export function useSurfaceTone(): SurfaceTone {
  return useContext(SurfaceContext);
}

export function useSurface(): Surface {
  return surfaces[useContext(SurfaceContext)];
}

/** 16pt of side gutter on the narrowest phones, 20pt from 375 upward. */
export function useGutter(): number {
  const { width } = useWindowDimensions();
  return width >= 375 ? chrome.gutterWide : chrome.gutterNarrow;
}
