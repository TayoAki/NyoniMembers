/**
 * What this build is allowed to talk to.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at bundle time, not at run time, so these are fixed when
 * the bundle is made: a hosted preview needs them set as *build* variables, and changing one means
 * a rebuild. They must be read as literal member expressions for that substitution to happen.
 *
 * With neither set the app runs entirely on fixtures, which is how the design was reviewed and how
 * a preview behaves until the house points it at a deployment. With the Clerk key alone, sign-in is
 * real and the member's wardrobe is still invented. With both, nothing is invented.
 */

export const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
export const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";

/** Sign-in, sign-out and the member's real name and email. */
export const isAuthLive = clerkPublishableKey.length > 0;

/** The member's wardrobe, membership and previews, read from the house's own deployment. */
export const isBackendLive = isAuthLive && convexUrl.length > 0;

export type BackendMode = "fixtures" | "auth" | "live";

export const backendMode: BackendMode = isBackendLive ? "live" : isAuthLive ? "auth" : "fixtures";

export const BACKEND_MODE_LABELS: Record<BackendMode, string> = {
  fixtures: "Preview build — invented members, invented wardrobes",
  auth: "Signed in for real; wardrobe and previews are still invented",
  live: "Connected to the house",
};
