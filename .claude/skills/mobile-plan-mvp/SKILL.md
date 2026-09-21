---
name: mobile-plan-mvp
description: "Turn a mobile app idea into a bounded MVP plan with user journeys, scope, acceptance criteria, and implementation order. Use when planning a mobile release or reducing an oversized feature list before design or coding."
---

# Mobile MVP Planning

Convert the user's intent into a buildable plan. Read `references/fitness-example.md` when applying this workflow to the fitness creator app or when a concrete worked example is useful.

## Workflow

1. Reconstruct the objective from the conversation and existing project files. Separate confirmed choices, recommendations, and unknowns. Preserve the user's intended product and revenue model.
2. Define the first customer, the job they need done, the first measurable outcome, and the release type: demonstration, paid pilot, or public launch. Ask only about unresolved choices that materially affect the plan; do not repeat answers already supplied.
3. Describe one complete value journey. For a two-sided product, include both the supplier's publication flow and the customer's consumption flow. Include how the supplier gets paid when monetization is the product's purpose.
4. Select the smallest feature set that completes that journey. Separate later enhancements explicitly. Do not inherit the tutorial's social feed, stories, direct messages, or payment exclusion as universal MVP defaults.
5. Map the journey to screens and states, data entities, ownership, external services, and acceptance criteria. Include empty, loading, failure, and access-denied behavior where it changes the experience.
6. Propose a stack only after checking the existing repository and release constraints. Treat Expo, Clerk, and Convex as the tutorial's example stack. Verify current official compatibility documentation before prescribing versions or commands. Keep platform, purchase-channel, video delivery, and creator payout decisions visible.
7. Sequence thin working features with dependencies and demonstrable outcomes. Write or update a project plan when requested. Preserve a user's request for planning only; creating a plan does not imply starting implementation.

## Output

Produce a concise decision record with:
- Product promise, primary users, and confirmed constraints.
- Creator and member journeys, or the equivalent roles for another app.
- Build-now/later table with reasons and dependencies.
- Screen inventory and key data/access boundaries.
- Acceptance criteria for the first working transaction or equivalent outcome.
- A proposed measurement plan with event definitions and denominators.
- Open decisions, a recommended default for each, and what evidence would resolve it.

Use targets as hypotheses until measured. Explain success in terms of useful behavior and repeat use, not screen count. If asked for one feature, describe one usable end-to-end capability with its necessary supporting parts.

## Completion check

Check that every build-now item supports the primary journey or a concrete release requirement. Check that the plan can demonstrate the promised value without relying on simulated payments, fabricated demand, or unimplemented access control. Distinguish a demo from a production-ready release.
