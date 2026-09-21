import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { member } from "./fixtures";
import { TIER_RANK, type MembershipTier } from "./types";

/**
 * Who the member is and what they may reach. Fixture-backed for now: M2 replaces the identity half
 * with Clerk and M7 replaces the entitlement half with a Convex query over the RevenueCat state.
 *
 * The shape is deliberately the one the backend will serve, and `hasAtelier` mirrors the single
 * server function described in the plan: you bought Atelier, your Circle membership includes it, or
 * your fourteen-day preview is still running. Nothing in the app decides access any other way.
 */

/** Each demo state is a real state a member can be in, not a debug flag. */
export const DEMO_STATES = ["signed-out", "preview", "free", "atelier", "circle"] as const;
export type DemoState = (typeof DEMO_STATES)[number];

export const DEMO_STATE_LABELS: Record<DemoState, string> = {
  "signed-out": "Signed out",
  preview: "Free, in the 14-day preview",
  free: "Free, preview expired",
  atelier: "Atelier subscriber",
  circle: "Prestige member",
};

export type Session = {
  isSignedIn: boolean;
  isLoading: boolean;
  member: typeof member | null;
  tier: MembershipTier;
  /** True when Atelier features are reachable, whatever the route in. */
  hasAtelier: boolean;
  /** Why they have it, so a screen can say "included with Prestige" rather than "subscribed". */
  atelierSource: "subscription" | "membership" | "preview" | null;
  previewDaysLeft: number;
  previewsUsed: number;
  previewsIncluded: number;
  demoState: DemoState;
  setDemoState: (state: DemoState) => void;
  atLeast: (tier: MembershipTier) => boolean;
};

const SessionContext = createContext<Session | null>(null);

const DAY = 86_400_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoState, setDemoState] = useState<DemoState>("circle");

  const value = useMemo<Session>(() => {
    const isSignedIn = demoState !== "signed-out";
    const tier: MembershipTier = demoState === "circle" ? "prestige" : "client";
    const atelierSource: Session["atelierSource"] =
      demoState === "circle"
        ? "membership"
        : demoState === "atelier"
          ? "subscription"
          : demoState === "preview"
            ? "preview"
            : null;
    return {
      isSignedIn,
      isLoading: false,
      member: isSignedIn ? member : null,
      tier,
      hasAtelier: atelierSource !== null,
      atelierSource,
      previewDaysLeft: demoState === "preview" ? 9 : 0,
      previewsUsed: demoState === "circle" ? 7 : demoState === "atelier" ? 3 : 1,
      previewsIncluded: 60,
      demoState,
      setDemoState,
      atLeast: (required: MembershipTier) => TIER_RANK[tier] >= TIER_RANK[required],
    };
  }, [demoState]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider.");
  return value;
}

/** Convenience for a screen that only cares whether the Atelier gate is open. */
export function useAtelier(): { unlocked: boolean; source: Session["atelierSource"]; daysLeft: number } {
  const { hasAtelier, atelierSource, previewDaysLeft } = useSession();
  return { unlocked: hasAtelier, source: atelierSource, daysLeft: previewDaysLeft };
}

/** The bag is local state until M4 gives it a table. */
export function useBagCount(lines: { qty: number }[]): number {
  return useCallback(() => lines.reduce((total, line) => total + line.qty, 0), [lines])();
}

export const PREVIEW_LENGTH_DAYS = 14;
export const PREVIEW_ENDS_AT = Date.now() + 9 * DAY;
