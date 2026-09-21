---
name: mobile-auth-access
description: "Plan, implement, or review mobile authentication, onboarding, account roles, session behavior, and account deletion. Use for sign-in flows or identity-to-backend access boundaries; distinguishes being signed in from owning content or having paid access."
---

# Mobile Sign-In and Access

Establish who the user is and what identity-based actions they may perform. Read `references/fitness-example.md` for the fitness app's actor matrix and verification scenarios.

## Workflow

1. Inspect the chosen platforms, auth provider, installed SDKs, routes, and backend. Preserve working integrations. Confirm current official provider documentation before changing callback schemes, token storage, or provider configuration. Treat Clerk/Expo as tutorial examples.
2. Separate identity, creator ownership, administrative permission, and paid entitlement. Permit multiple capabilities on one account when the product requires it. Derive identity from verified server context, never from a client-supplied owner ID or editable role field.
3. Define public browsing, sign-in triggers, onboarding, session restoration, sign-out, and expired-session behavior. Do not make public previews require login unless the plan calls for it. Preserve the intended destination after authentication.
4. Configure each requested provider and each environment explicitly. Keep privileged keys server-side. Do not print tokens or commit secrets; public client keys are not substitutes for server credentials.
5. Enforce authorization on backend reads, writes, and media issuance. Hiding a button or guarding a route is only a UI measure. Hand purchase validation to the billing/backend flow rather than trusting a client success screen.
6. Design account deletion as a data lifecycle: authenticate the request, identify owned records/media, distinguish deletable and justified retained records, revoke sessions, and handle provider/app cleanup failures with retryable work. Explain active subscriptions and their management truthfully; deleting an app identity does not itself prove recurring billing has stopped.
7. Verify each sign-in provider independently on the target build. Record canceled login, failed callback, cold restart, sign-out, expired session, and cross-account attempts. Test deletion on disposable test accounts, including partial cleanup failure. Mark unavailable device/provider checks as unverified.

## Output

Provide the actor/action access matrix, route/session flow, environment configuration requirements without secret values, implementation changes if requested, and a verification record. List exact unresolved dashboard actions rather than assuming integration is automatic.

## Platform checks

Before release advice, consult the current Apple login-services/account-deletion guidance and corresponding Android requirements for the app's distribution context. Apple login guidance has conditions and exceptions; do not repeat the transcript's blanket claim that every social login always requires one particular implementation. Do not guarantee store acceptance.

## Completion check

A successful Google login is not evidence that Apple login works. A valid identity is not evidence of creator ownership or subscription access. Demonstrate both allowed and denied backend actions with distinct test identities.
