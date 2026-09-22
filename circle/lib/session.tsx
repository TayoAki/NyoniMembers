import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { backendMode, isAuthLive, isBackendLive, type BackendMode } from "./config";
import { api, type Me } from "./convex";
import { member } from "./fixtures";
import { TIER_RANK, type MembershipTier } from "./types";

/**
 * Who the member is and what they may reach.
 *
 * There are three ways this is answered and every screen is blind to which one is in play. With no
 * keys in the build it is fixtures, and the picker in Settings switches between the states a member
 * can be in. With a Clerk key it is a real sign-in against the house's own Clerk instance. With a
 * Convex URL as well, the membership and the wardrobe come from the same rows the web app writes.
 *
 * `hasAtelier` mirrors the single server function described in the plan: you bought Atelier, your
 * Circle membership includes it, or your fourteen-day preview is still running. Nothing in the app
 * decides access any other way.
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

export type Member = {
  id: string;
  name: string;
  email: string;
  initials: string;
  memberSince: number;
  imageUrl?: string;
};

export type Session = {
  isSignedIn: boolean;
  isLoading: boolean;
  member: Member | null;
  tier: MembershipTier;
  /** True when Atelier features are reachable, whatever the route in. */
  hasAtelier: boolean;
  /** Why they have it, so a screen can say "included with Prestige" rather than "subscribed". */
  atelierSource: "subscription" | "membership" | "preview" | null;
  previewDaysLeft: number;
  previewsUsed: number;
  previewsIncluded: number;
  /** Where the answers came from. Screens use it only to explain themselves, never to gate. */
  backend: BackendMode;
  demoState: DemoState;
  setDemoState: (state: DemoState) => void;
  signOut: () => Promise<void>;
  atLeast: (tier: MembershipTier) => boolean;
};

const SessionContext = createContext<Session | null>(null);

const DAY = 86_400_000;
export const PREVIEW_LENGTH_DAYS = 14;

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/** How long a new member's free look at Atelier has left, counted from the day they joined. */
function previewDaysLeft(joinedAt: number): number {
  const elapsed = Math.floor((Date.now() - joinedAt) / DAY);
  return Math.max(0, PREVIEW_LENGTH_DAYS - elapsed);
}

// -- Fixtures ------------------------------------------------------------------------------------

function FixtureSessionProvider({ children }: { children: ReactNode }) {
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
      backend: "fixtures",
      demoState,
      setDemoState,
      signOut: async () => setDemoState("signed-out"),
      atLeast: (required: MembershipTier) => TIER_RANK[tier] >= TIER_RANK[required],
    };
  }, [demoState]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// -- Clerk, with or without the house's deployment behind it ---------------------------------------

/**
 * Reads the member's row, creating it on first sign-in so nothing downstream has to check. `ensure`
 * is idempotent, and until it lands `users.me` answers null for a perfectly valid member.
 */
function useHouseMember(enabled: boolean): Me | null | undefined {
  const me = useQuery(api.users.me, enabled ? {} : "skip");
  const ensure = useMutation(api.users.ensure);

  useEffect(() => {
    if (!enabled || me !== null) return;
    void ensure({}).catch(() => {
      // The query keeps answering null and the app stays on the free tier, which is the safe read.
    });
  }, [enabled, me, ensure]);

  return me;
}

function ClerkSession({ children, me }: { children: ReactNode; me?: Me | null }) {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  const value = useMemo<Session>(() => {
    const name = me?.name ?? user?.fullName ?? "";
    const email = me?.email ?? user?.primaryEmailAddress?.emailAddress ?? "";
    const joinedAt = me?.createdAt ?? user?.createdAt?.getTime() ?? Date.now();

    // A house-set tier is the only tier. Until the deployment is reachable every member reads as a
    // client, which is the truthful answer rather than a flattering one.
    const membership = me?.membership;
    const tier: MembershipTier = membership && membership.status === "active" ? membership.tier : "client";
    const daysLeft = previewDaysLeft(joinedAt);
    const atelierSource: Session["atelierSource"] =
      TIER_RANK[tier] >= TIER_RANK.signature ? "membership" : daysLeft > 0 ? "preview" : null;

    return {
      isSignedIn: Boolean(isSignedIn),
      // `me === undefined` while the query is in flight; with no deployment it is never requested.
      isLoading: !isLoaded || (isBackendLive && Boolean(isSignedIn) && me === undefined),
      member: isSignedIn
        ? {
            id: me?._id ?? user?.id ?? "",
            name: name || email,
            email,
            initials: initialsOf(name, email),
            memberSince: joinedAt,
            imageUrl: me?.imageUrl ?? user?.imageUrl,
          }
        : null,
      tier,
      hasAtelier: atelierSource !== null,
      atelierSource,
      previewDaysLeft: atelierSource === "preview" ? daysLeft : 0,
      previewsUsed: 0,
      previewsIncluded: 60,
      backend: backendMode,
      demoState: isSignedIn ? "circle" : "signed-out",
      setDemoState: () => {},
      signOut: async () => {
        await signOut();
      },
      atLeast: (required: MembershipTier) => TIER_RANK[tier] >= TIER_RANK[required],
    };
  }, [isLoaded, isSignedIn, signOut, user, me]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function LiveSessionProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const me = useHouseMember(Boolean(isSignedIn));
  return <ClerkSession me={me}>{children}</ClerkSession>;
}

function AuthOnlySessionProvider({ children }: { children: ReactNode }) {
  return <ClerkSession>{children}</ClerkSession>;
}

/**
 * Chosen once, at module scope, from what the bundle was built with — so the hooks each provider
 * calls are fixed for the life of the app and React never sees a provider change identity.
 */
const Provider = isBackendLive
  ? LiveSessionProvider
  : isAuthLive
    ? AuthOnlySessionProvider
    : FixtureSessionProvider;

export function SessionProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider.");
  return value;
}

/** Convenience for a screen that only cares whether the Atelier gate is open. */
export function useAtelier(): { unlocked: boolean; source: Session["atelierSource"]; daysLeft: number } {
  const { hasAtelier, atelierSource, previewDaysLeft: daysLeft } = useSession();
  return { unlocked: hasAtelier, source: atelierSource, daysLeft };
}

/** The bag is local state until M4 gives it a table. */
export function useBagCount(lines: { qty: number }[]): number {
  return useCallback(() => lines.reduce((total, line) => total + line.qty, 0), [lines])();
}

export const PREVIEW_ENDS_AT = Date.now() + 9 * DAY;
