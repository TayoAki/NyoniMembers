"use client";

import type { ReactNode } from "react";
import { AtelierSessionProvider } from "./atelier-session";
import { AtelierTopbar } from "./atelier-topbar";

/**
 * The Atelier's frame: session (guest key + local drafts), the top bar and the content column.
 * Guests and clients share it; the staff desk lives in the signed-in app shell instead.
 */
export function AtelierShell({ children }: { children: ReactNode }) {
  return (
    <AtelierSessionProvider>
      <div className="atelier-shell flex min-h-svh min-w-0 flex-col bg-background text-foreground">
        <a
          href="#atelier-main"
          className="sr-only fixed top-3 left-3 z-50 bg-primary px-5 py-3 text-primary-foreground focus:not-sr-only"
        >
          Skip to content
        </a>
        <AtelierTopbar />
        <main id="atelier-main" className="@container mx-auto w-full max-w-[1520px] flex-1 px-4 pb-24 sm:px-8 lg:px-12 lg:pb-12">
          {children}
        </main>
      </div>
    </AtelierSessionProvider>
  );
}
