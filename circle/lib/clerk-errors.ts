import { isClerkAPIResponseError } from "@clerk/clerk-expo";

/**
 * Clerk's bot protection is a Turnstile widget rendered in a browser. A custom flow on a phone has
 * nowhere to put one, so an instance with it switched on refuses every sign-up from this app with
 * a message about "security validations" that tells a member nothing. Say something true instead,
 * and turn the setting off in the Clerk dashboard (User & Authentication → Attack protection).
 */
const CAPTCHA_CODES = new Set(["captcha_missing_token", "captcha_invalid", "captcha_unavailable"]);

export function isCaptchaBlocked(error: unknown): boolean {
  return isClerkAPIResponseError(error) && error.errors.some((item) => CAPTCHA_CODES.has(item.code));
}

/**
 * Clerk answers with a list of errors, each with a long message and a short one. The long one is
 * what a member should read; the list's first entry is the one that stopped them.
 */
export function clerkMessage(error: unknown, fallback: string): string {
  if (isCaptchaBlocked(error)) {
    return "This build cannot open new accounts. Ask your clothier to open yours, then sign in with that email.";
  }
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    if (first) return first.longMessage ?? first.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
