---
name: mobile-backend-memberships
description: "Build or review a mobile backend with persistent data, ownership checks, media delivery, and creator membership entitlements. Use when replacing mock data, implementing paid creator access, or testing a connected mobile app with real identities and devices."
---

# Mobile Backend and Memberships

Connect the user journey to real persistent state and verified access. Read `references/fitness-example.md` for a proposed creator-fitness schema and purchase/access scenarios. Billing and payout guidance here extends the tutorial, which did not implement payments.

## Workflow

1. Read the agreed scope and existing schema/integrations. Identify simulated fixtures, real records, environments, identities, and API boundaries. Treat Convex as the tutorial's example, not a mandatory migration.
2. Model entities around ownership and relationships. For creator subscriptions, distinguish free follows, purchase records, membership entitlements, program inclusion, and earnings/payout accounting. Decide what happens when a creator changes membership coverage or removes content.
3. Replace one complete fixture-backed flow at a time with validated server operations. Check ownership/identity in every relevant query and mutation. Paginate catalog reads, validate uploads, and make retries safe. Keep demo fixtures isolated from production metrics and public claims.
4. Protect premium media as well as metadata. Generate authorized, short-lived playback access or use equivalent provider controls. Keep paid URLs out of public responses and fixtures. Handle encoding readiness, interrupted upload, and playback failure. Explain that access control does not promise prevention of all copying.
5. Before choosing a billing path, establish launch platform, storefront/market, product type, and current official store/provider requirements. Do not assume a web checkout is permitted everywhere or that digital workout access is equivalent to an in-person class. Separate collecting member payments from paying creators.
6. Validate purchases server-side through the chosen provider. Verify event authenticity, bind the buyer and creator/product, enforce event uniqueness, and tolerate duplicate, delayed, and out-of-order notifications. Derive access from current verified state and the explicit grace/refund policy. Define pending, active, canceled-but-still-paid, expired, refunded/revoked, and grace states where supported.
7. Reconcile provider state after uncertain events. Make purchase restoration, refund effects, and multiple creator memberships explicit. Track gross sales, fees, refunds, creator share, payable balance, and payout status separately if monetization is in scope; do not label unverified or unpaid funds as paid earnings.
8. Test with different real test identities and persistence after relaunch. Use development builds when native integrations need them. Keep backend/mobile environments aligned. Inspect the first actionable build error and make a targeted fix; avoid broad cache deletion or dependency upgrades without evidence.

## Output and evidence

Return schema/access decisions, implemented endpoints or a bounded implementation plan, purchase-state rules, fixture migration status, and test results with environment/device details. A successful UI animation is not proof of a database write or payment. Record backend and provider evidence without exposing private data.

Stop when the agreed working flow and meaningful denial/failure cases pass. If device or provider access is missing, deliver the runnable work and a specific unverified checklist; do not claim a phone or live payment test occurred.
