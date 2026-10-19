import type { StatusTone } from "@/components/atelier/common/status-line";
import type { ViewerStatus } from "@/hooks/atelier/use-atelier-viewer";
import { routes } from "@/lib/routes";
import type { FitPhotoPose, FitProfileStatus, FitRoute } from "@convex/shared/atelier/enums";

/** Who is looking, as `useAtelierViewer` reports it; passed down so one check drives every panel. */
export type Viewer = { status: ViewerStatus; convexReady: boolean };

/** The fit page's three panels; the `tab` query parameter names one so other screens can link straight to it. */
export const FIT_TABS = ["routes", "profile", "measure"] as const;
export type FitTab = (typeof FIT_TABS)[number];
export function isFitTab(value: string | null): value is FitTab {
  return value !== null && (FIT_TABS as readonly string[]).includes(value);
}
export const FIT_TAB_LABELS: Record<FitTab, string> = {
  routes: "Routes",
  profile: "Your profile",
  measure: "Measure at home",
};

export function fitTabHref(tab: FitTab): string {
  return `${routes.atelier.fit}?tab=${tab}`;
}

export function signInHref(returnTo: string): string {
  return `${routes.signIn}?redirect_url=${encodeURIComponent(returnTo)}`;
}

/** Colour never carries the meaning alone; the words from `FIT_PROFILE_STATUS_LABELS` do. */
export const PROFILE_TONES: Record<FitProfileStatus, StatusTone> = {
  provisional: "neutral",
  needs_clarification: "warning",
  approved: "gold",
  superseded: "neutral",
};

export const POSE_LABELS: Record<FitPhotoPose, string> = { front: "Front", side: "Side", back: "Back" };
export const POSE_GUIDES: Record<FitPhotoPose, string> = {
  front: "Facing the camera, standing straight, arms relaxed at your sides.",
  side: "Side on, natural stance, so the fitter can read your posture.",
  back: "Back to the camera, arms relaxed, shoulders as you hold them.",
};

/**
 * Separate from the preview consent (`PHOTO_CONSENT`): these photographs go to a fitter and nowhere
 * else. The sentence is shown beside the consent checkbox before any file can be chosen.
 */
export const FIT_PHOTO_CONSENT =
  "Posture photographs are optional. They are seen only by the fitter reviewing your profile, to read posture and stance alongside your measurements. They are never used for personal previews, marketing, identity recognition or anything else, and you can remove them from your profile at any time.";

/** What each fit route involves, in plain words; facts about the house come from `HOUSE_POLICY` and `SHOWROOMS`. */
export const ROUTE_SUMMARIES: Record<FitRoute, string> = {
  atelier: "A clothier measures you in person and fits the suit as it is made.",
  remote: "You measure with the guide; a fitter reviews every value before it is used.",
  undecided: "Ask the house which route suits your timing and where you are.",
};
export const ROUTE_BRING: Record<FitRoute, string> = {
  atelier: "The shoes and a shirt you would wear with the suit, and your date if there is one.",
  remote: "A soft tape measure, a shirt and trousers that fit, and someone to help with the back.",
  undecided: "Nothing yet. Your concierge will tell you what the chosen route needs.",
};
