# Source and fitness application

User-provided transcript: Pasted markdown(20260918-070742).md, reviewed 18 September 2026. The source describes an Instagram-style Expo tutorial; the fitness marketplace examples below are adaptations, not claims made in the video.

## Transcript mapping

Chapter 1, “Planning Our Project” (lines 197–746), with the preview as context. Transfer the interview-to-plan workflow, explicit screens/user flows, phased scope, empty-state decisions, and written plan. Do not transfer “skip payments”: the tutorial builds a social demo, whereas this app sells workouts.

## Worked application

Confirmed concept: people browse fitness creators, watch free content, and subscribe to a particular creator for workouts/programs. Creators earn an additional online revenue stream. Meetups and rankings were explored but are not the initial transaction.

Proposed first segment: independent trainers with an existing audience or class attendees. This is a testable segment recommendation, not established demand.

Proposed promise: “Publish a paid workout channel using the content you already have.”

Creator journey: create a channel → upload a free sample → assemble a paid program → set the membership offer → preview → publish → share its link → see member and earnings status.

Member journey: browse a small creator directory or open a shared link → watch the sample → see exactly what membership includes → sign in → purchase → open the entitled program → complete the first workout → return for the next session.

Build now: creator profile, free preview, simple program builder, membership purchase and access, workout playback/instructions, completion state, basic creator earnings accounting, account settings and support. The creator dashboard can initially be web-based; this is a recommendation to reduce mobile editing work.

Later unless requested: algorithmic video feed, stories, DMs, live classes, wearables, meal plans, meetups, public rankings, and a separate app for each creator.

Acceptance example: trainer A publishes a free sample and paid program; member B can view the sample; B cannot fetch paid content before purchase; a verified purchase grants only A's membership; B completes a workout and sees that completion after relaunch; A sees a correctly attributed sale. Use sandbox transactions for the prototype and an authorized live pilot for proof of payment.

Measure publication rate, time to publish, creator-page-to-purchase conversion, first-workout completion among new paying members, second-workout return, and renewal. Set a cohort and observation window before interpreting rates. Do not present a target percentage as an industry benchmark.

Unresolved decisions: launch platforms/markets, billing route, membership price, platform fee, creator payout arrangement, and whether all programs or selected programs are included in a channel membership.
