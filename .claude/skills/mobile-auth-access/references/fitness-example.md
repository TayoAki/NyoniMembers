# Source and fitness application

User-provided transcript: Pasted markdown(20260918-070742).md, reviewed 18 September 2026. The source describes an Instagram-style Expo tutorial; the fitness marketplace examples below are adaptations, not claims made in the video.

## Transcript mapping

Chapter 3, “Authentication” (lines 945–1502), plus the account-deletion segment in Chapter 5 (lines 2133–2402). Transfer real provider setup, development-build testing, onboarding, and sign-out. Correct the tutorial's claim that one working provider proves another works. Extend deletion beyond checking that a provider's user count dropped.

## Worked application

| Actor | Allowed | Denied |
|---|---|---|
| Visitor | Browse published creators and free samples | Paid workout/media access; draft access |
| Signed-in member | Own profile, own progress, own purchases | Another member's private progress |
| Creator | Own channel, drafts, programs, allowed member summaries | Another creator's edits or earnings |
| Active subscriber to A | Workouts included in A's membership | B's paid workouts without a separate entitlement |
| Administrator | Explicitly assigned moderation/support actions | Implicit unlimited access from a UI role toggle |

A creator can also subscribe to another creator. Model role/capability membership rather than forcing one exclusive account type. Do not treat following a creator as paying them.

Example checks: open A's free sample while signed out; sign in and return to A's offer; cancel authentication without a stuck spinner; relaunch and restore a valid session; use B's identifiers in a direct API request and observe denial; delete a disposable member and verify app data/provider cleanup plus stated retention handling. Test each configured provider on each supported platform.

## Official references

- Clerk Expo quickstart: https://clerk.com/docs/expo/getting-started/quickstart
- Convex identity in functions: https://docs.convex.dev/auth/functions-auth
- Apple review guidelines, sections 4.8 and 5.1.1: https://developer.apple.com/app-store/review/guidelines/

Reviewed 18 September 2026. Recheck applicable versions and policy language when executing; the transcript is not current policy authority.
