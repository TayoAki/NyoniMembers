---
name: mobile-build-verify
description: "Implement or repair one mobile feature at a time using a plan, visual references, runtime checks, and targeted review. Use for mobile screen implementation, screenshot-based UI refinement, regression fixes, and completing a feature before moving to the next."
---

# Mobile Feature Build and Verify

Turn a bounded feature into verified behavior. Read `references/fitness-example.md` for the fitness app's recommended slices and worked validation case.

## Workflow

1. Inspect the repository instructions, plan, reference screen, current implementation, and working tree. State the feature's user outcome, affected screens/data, and acceptance criteria. Preserve unrelated work and project decisions.
2. Implement the smallest complete slice. Use the existing component/design system, navigation, and API conventions. Keep fixtures explicit during UI work; replace them with real behavior before claiming the connected feature is complete.
3. Run available checks proportional to the change: build/type checks where relevant, focused logic or integration tests for money/access/persistence, and interaction checks on a running app. Do not equate an AI review or successful compilation with correct behavior.
4. For visual work, capture the implemented screen in a known viewport/state, compare with the reference, identify concrete differences, and fix the highest-impact mismatch. Check layout, hierarchy, copy, spacing, safe areas, large text, keyboard, and navigation. Preserve native usability over pixel imitation.
5. Bound the compare/fix loop. Use up to three focused passes by default; stop earlier once acceptance is satisfied or no useful progress is possible. Report remaining differences and their cause. Never run an unlimited “until identical” loop. If screenshots or a simulator are unavailable, state that and perform the available checks.
6. Exercise the feature's primary flow, relevant failures, and adjacent regression paths. For connected features, verify persisted results and denial cases rather than only visual states. Fix one diagnosed issue at a time when multiple speculative edits would obscure cause.
7. Review the changed code and meaningful review findings. Reproduce material findings, fix them, and re-run affected checks on the changed revision. An AI-suggested patch does not waive verification or an existing review gate.
8. Record durable project conventions in existing project instructions when supported by actual user choices or recurring evidence. Scope rules narrowly; do not turn the tutorial's preferred tabs, colors, or tools into rules for every project.

## Output

Summarize the behavior implemented, files/artifacts changed, observed verification, and remaining limitations. Keep a feature checklist with pending/implemented/verified distinctions. Link screenshots or test artifacts when useful. Commit or create reviewable changes only within the authorized workflow; this skill does not grant publication, merge, or production deployment permission.

## Completion check

Complete means the agreed acceptance criteria are demonstrated with available evidence. A visual draft can be complete as a draft; do not call it a working paid membership flow. Avoid adding stories, chat, rankings, or other tutorial features unless the product plan requires them.
