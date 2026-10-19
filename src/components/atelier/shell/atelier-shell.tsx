"use client";

import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AtelierSessionProvider } from "./atelier-session";
import { AtelierTopbar } from "./atelier-topbar";

/** Development only: `?theme=light|dark` sets the theme so both can be captured without a click. */
function PreviewThemeFromQuery() {
  const params = useSearchParams();
  const { setTheme } = useTheme();
  const requested = process.env.NODE_ENV === "production" ? null : params.get("theme");
  useEffect(() => {
    if (requested === "light" || requested === "dark") setTheme(requested);
  }, [requested, setTheme]);
  return null;
}

/**
 * The Atelier's frame: session (guest key + local drafts), the top bar and the content column.
 * Guests and clients share it; the staff desk lives in the signed-in app shell instead.
 */
export function AtelierShell({ children }: { children: ReactNode }) {
  return (
    <AtelierSessionProvider>
      <PreviewThemeFromQuery />
      <div className="atelier-shell flex min-h-svh min-w-0 flex-col bg-background text-foreground">
        <a
          href="#atelier-main"
          className="sr-only fixed top-3 left-3 z-50 bg-primary px-5 py-3 text-primary-foreground focus:not-sr-only"
        >
          Skip to content
        </a>
        <AtelierTopbar />
        <main
          id="atelier-main"
          className="@container mx-auto w-full max-w-[1520px] flex-1 px-4 pb-24 sm:px-8 lg:px-12 lg:pb-12"
        >
          {children}
        </main>
      </div>
    </AtelierSessionProvider>
  );
}
