import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk 7 keeps auth context in the proxy but gates access per resource: every signed-in page and
 * layout calls `requireSignedIn()` (src/lib/auth.ts) and every Convex function calls `requireUser`.
 * Public routes (landing, sign-in/up, /share, /atelier, eve) simply don't call it; eve verifies its own bearer tokens.
 *
 * `ATELIER_PREVIEW_NO_AUTH=1` (development only) skips Clerk entirely so the guest Atelier can be
 * rendered and screenshotted on a machine without Clerk keys; signed-in routes then 500 by design.
 */
const previewWithoutAuth = process.env.ATELIER_PREVIEW_NO_AUTH === "1" && process.env.NODE_ENV !== "production";

export default previewWithoutAuth ? () => NextResponse.next() : clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
