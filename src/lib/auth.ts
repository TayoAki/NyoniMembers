import { auth } from "@clerk/nextjs/server";

/**
 * Resource-level protection for every signed-in page and layout (Clerk 7 guidance: the proxy no
 * longer gates routes by path). Redirects to sign-in when there is no session.
 */
export async function requireSignedIn(): Promise<void> {
  await auth.protect();
}
