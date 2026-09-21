# Source and fitness application

User-provided transcript: Pasted markdown(20260918-070742).md, reviewed 18 September 2026. The source describes an Instagram-style Expo tutorial; the fitness marketplace examples below are adaptations, not claims made in the video.

## Transcript mapping

Chapter 4, “Setting Up Backend & Running App on Our Phone” (lines 1503–2132). Transfer real database operations, identity integration, distinguishing seed data from actual persistence, multi-account checks, device builds, and diagnosis from build logs. Membership state, protected video, payment verification, and payout accounting are fitness-product additions.

## Proposed minimal model

| Entity | Purpose / boundary |
|---|---|
| User | Verified external identity and app profile |
| CreatorChannel | Owner, published identity, description |
| Content / MediaAsset | Owner, publication state, free/premium visibility, processing status |
| Program / Workout | Ordered sessions, exercise instructions, equipment, video references |
| MembershipOffer | Creator, included content, provider product mappings, price/period |
| Purchase / Entitlement | Verified buyer, creator/offer scope, source, validity and status |
| Progress | User-owned workout completion; private by default |
| BillingEvent | Unique provider event, processing state, reconciliation evidence |
| CreatorLedger / Payout | Attributed sales/adjustments, payable balance, payout evidence |

These are logical entities, not a mandate for eleven separate tables. Use the chosen database's appropriate structure.

## Walkthrough

Trainer Maya publishes one free video and a four-week program included in her monthly channel membership. A visitor watches the free video. A logged-in member purchases Maya's membership in the selected billing channel. The server verifies the transaction and records Maya-scoped access. The member opens session one, receives authorized playback, and marks it complete. The completion survives relaunch. Maya sees sale attribution and the appropriate pending/payable state, not a fabricated completed payout.

## Critical cases

- Purchase dialog succeeds but verification is delayed: show pending and reconcile; do not grant access from the device alone.
- The same billing event arrives twice: do not double-credit earnings or duplicate access.
- Membership is canceled but paid access remains until period end: apply the stated policy and provider state rather than immediately revoking.
- A refund or chargeback arrives after an older renewal event: reconcile current provider state before changing access/accounting.
- A subscriber to Maya tries another creator's protected media endpoint: deny.
- Member installs on a second device: restore or rehydrate access according to the billing provider and identity model.

## Official references

Convex function identity: https://docs.convex.dev/auth/functions-auth
Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
Apple payment guidance: https://developer.apple.com/app-store/review/guidelines/
Google Play payments: https://support.google.com/googleplay/android-developer/answer/9858738

Reviewed 18 September 2026. Verify current billing/provider documentation before implementation; no payment provider or platform fee is selected by this example.
