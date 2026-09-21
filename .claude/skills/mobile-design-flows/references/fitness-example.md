# Source and fitness application

User-provided transcript: Pasted markdown(20260918-070742).md, reviewed 18 September 2026. The source describes an Instagram-style Expo tutorial; the fitness marketplace examples below are adaptations, not claims made in the video.

## Transcript mapping

Chapter 2, “Generating UI Design” (lines 747–944). Transfer plan-derived design prompts, a shared design system, detailed screen references, and focused iteration. The written state specification and accessibility checks are additions for a usable product.

## Worked application

Proposed member navigation: Discover, My Workouts, Profile. Reach a creator channel from Discover or a shared link. Keep creator publishing in a simple web dashboard initially if approved in the product plan.

| Screen | Decision or action | Essential states |
|---|---|---|
| Discover | Find a relevant creator | Small real catalog, empty search, loading |
| Creator channel | Try content or subscribe | Free sample, paid library, existing member |
| Program detail | Understand commitment and equipment | Preview, locked, entitled, unavailable |
| Membership offer | Understand and buy creator access | Offer, canceled, pending, failed, active |
| Workout session | Follow instructions and complete | Ready, buffering, interrupted, completed |
| My Workouts | Continue the next session | No programs, in progress, completed |
| Creator editor | Publish a channel/program | Draft, uploading, upload failed, published |

Proposed channel layout: creator identity and specialization; free sample with a clear play button; program cards showing level, equipment, duration, and sessions; a membership explanation with price and billing period; subscribe/manage membership action. A free Follow action must remain distinct from paid Subscribe if both are included.

## Reusable prompt

“Design the creator channel and workout session for a fitness creator membership app. Fans can watch a free sample, inspect the program outline, and subscribe to this creator's included workouts. Use the attached brand references and the written tokens. Show a free visitor state and an active-member state. Make creator identity, equipment, level, session duration, membership scope, and recurring price clear. Keep the main action prominent. Use fictional sample data labeled as a design fixture. Produce a screen overview and one detailed channel reference; provide a separate written component/state specification.”

Prefer a visible next workout and understandable membership to extra social engagement controls. Rankings and meetup discovery remain later design work unless scope changes.
