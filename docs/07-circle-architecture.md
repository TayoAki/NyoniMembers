# Nyoni Circle — the architecture

This document answers four questions that `docs/05-mobile-app-plan.md` either left open or, in one
case, answered differently: where the member's data lives, how they sign in, how the stylist talks
to the app, and what "styled by other members" would mean here. It also describes the hosted
preview, which exists now.

It supersedes commitment 1 of §5 and decision D8 of the plan. Everything else in the plan stands.

---

## 0. The short version

| Question                           | Answer                                                                          | Reversible until |
| ---------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| One Convex deployment or two?      | **One** — the house's existing deployment, with Circle's tables added alongside | M1 starts        |
| Identity                           | **Clerk**, the same instance as the web app, email code on mobile               | done             |
| The stylist's runtime              | **eve**, as today. Not CopilotKit                                               | M9               |
| How the stylist streams to a phone | Convex HTTP action in front of eve, read with `expo/fetch`                      | M0 spike         |
| Try-on and wardrobe on mobile      | The pipeline that exists. Nothing new to build server-side                      | —                |
| Members styling each other         | Shared looks with a revocable token; the clothier is the same mechanism         | v1.1             |

---

## 1. One deployment, not two

The plan committed to a second Convex deployment for Circle, on the reasoning that the live web app
should not be put at risk by reshaping a running system. That reasoning is sound and the conclusion
is still wrong, for four reasons that only became clear once the front end was built.

**A member is one person.** Two deployments mean a member who has used the web app has a wardrobe
there and an empty one in Circle. The capsule gets seeded twice. Their try-on history splits down
the middle. Nothing reconciles them, because they are keyed by the same `clerkId` in two databases
that never speak. The entire premise of Circle is that the house knows you; two member rows is the
opposite of that.

**The thing that carries over is the expensive thing.** The plan says `convex/ai/*` comes across —
the tuned prompts and the model calls. In a second deployment that is a _copy_: two sets of prompts
to keep in step, two daily spend caps, two job pipelines, two places a model version can drift. The
AI engine is the last thing in this system that should exist twice.

**The neighbour is asleep.** `AGENTS.md` freezes the web app and its backend while Circle is built.
The risk the plan was protecting against — reshaping a running system — is a risk to a system that
nobody is shipping to.

**Convex is additive.** New tables and new files do not touch existing ones. Circle's tables live in
the schema next to the web app's; Circle's functions live under `convex/circle/*`. No function the
web app calls changes signature, and `npx convex deploy` rejects a schema change that would orphan
existing documents, so the failure mode is a refused deploy, not a broken app.

**What this costs, honestly.** Circle inherits the Fitcheck vocabulary the plan wanted rid of:
`plan`, `planCredits`, `packCredits` and the credit meter. That debt is real. It is also being paid
down in place regardless — `AGENTS.md` already describes the allowance phase that replaces it — and
paying it once in one schema is cheaper than maintaining a clean one beside a dirty one.

**Shared, therefore:** `users` (and `users.membership`), `items`, `outfits`, `avatars`, `uploads`,
`renders`, `jobs`, `threads`, the credit ledger, and everything under `convex/ai/`.
**New, under `convex/circle/`:** drops, bag, orders, appointments, the suit entitlement, Atelier
entitlement and the RevenueCat webhook.

The one thing to decide before M1: production or a separate Convex deployment for Circle's
development. Use `accomplished-lemur-843` (the existing development deployment) while building, and
`good-donkey-546` for the released app. That is how the web app already works.

---

## 2. Identity

**Clerk, the same instance, for both apps.** Already built, and live in `circle/` now.

The member signs in with an email code. No password, because the house never asks for one, and no
social buttons on a screen the hosted web preview can reach — Sign in with Apple and Google need a
development build and a redirect URL the static web export cannot offer. They go in at M2 alongside
the device build, where Apple's guideline 4.8 requires Sign in with Apple to sit beside any other
social login anyway.

Because it is the same Clerk instance, the same accounts work in both apps, and a tier set by the
staff form in Admin (`admin.setMembershipTier`) shows up in Circle with no further plumbing. The app
never decides membership; `users.membership` does, and only `setMembership` writes it.

`circle/lib/session.tsx` holds the whole seam. It picks one of three implementations from what the
build was given, and every screen calls one `useSession()` regardless:

| Build has                           | Identity            | Membership and wardrobe |
| ----------------------------------- | ------------------- | ----------------------- |
| nothing                             | the Settings picker | fixtures                |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | real                | fixtures                |
| both keys                           | real                | the house's deployment  |

**Not done, and required before submission:** in-app account deletion. App Store guideline 5.1.1(v)
requires it of any app that lets you create an account. `users.deleteAllData` erases the member's
content but deliberately keeps the account row; deleting the Clerk user is a separate call that does
not exist yet. Until it does, Settings says so rather than offering a button that only signs out.

---

## 3. The stylist: eve stays, CopilotKit does not

CopilotKit came up as an option and it deserves a real answer rather than a shrug, because the case
for it is genuinely good.

**What it would give us.** It has a real React Native SDK — `@copilotkit/react-native`, with a
`/headless` entry point that has no native dependencies, so it runs under Expo without a config
plugin. It brings a maintained chat surface and, more interestingly, _generative UI_: a tool the
agent calls can render a React Native component inside the thread rather than returning text. An
outfit board the member can tap, in the conversation, is exactly the right shape for this product.
It also solves the streaming problem in §4 for free.

**What it would cost.** CopilotKit is a front end for a CopilotKit _runtime_. Adopting it means
standing up that runtime and re-expressing the agent: the persona in `agent/instructions.md`, the
Convex tools, the Clerk verification in `agent/channels/eve.ts`, the spend caps. Either the house
then runs two agent stacks — eve for the web app, CopilotKit for mobile, with the persona in two
places and drifting — or the web app migrates too, and the web app is frozen.

**Why the answer is no.** The value is concentrated almost entirely in generative UI, and the plan
already gets that result without a framework: eve returns a structured tool result, the app renders
`components/stylist/outfit-board.tsx`. One component, already built, already in the house's design
system. A framework earns its cost when there are many such components and their shapes keep
changing; there is one, and its shape is a look.

Adopting a young SDK on the single most important screen in the app, to replace an agent that is
already written, deployed and speaking in the house's voice, is a trade in the wrong direction.

**Revisit it if** in-thread generative UI grows past three or four component types, or if the house
decides to rebuild the web stylist at the same time. Not before.

---

## 4. How the stylist reaches a phone

This is the one genuine technical unknown, and it is worth stating precisely.

eve's client takes `host`, `auth`, `headers` and `redirect` — there is no place to inject a `fetch`
implementation (`node_modules/eve/dist/src/client/types.d.ts`). It uses the global `fetch`. React
Native's `fetch` does not expose a readable response body, so a stream arrives as nothing until it
ends. This is why `expo/fetch` exists.

**The design:** the app does not talk to eve. It calls a Convex HTTP action, `POST /circle/stylist`,
with its Clerk token. That action calls eve server-to-server with `AGENT_SERVICE_KEY` and pipes the
reply back as a streaming `Response`. The app reads it with `expo/fetch`, which does give a
`ReadableStream`.

```
 Expo app ──expo/fetch, Clerk token──▶ Convex /circle/stylist ──AGENT_SERVICE_KEY──▶ eve /eve/v1
     ◀────────── streamed tokens ──────────────┘                                        │
                                                                  Convex tools ◀────────┘
```

Three things this buys beyond streaming: the phone never holds a service key, the thread is
persisted at the hop that already has the member's identity, and the wire protocol is owned in one
place instead of being reimplemented against eve's format on the client.

**Prove it in the M0 spike**, in this order: (1) a Convex HTTP action returning a `ReadableStream`
reaches an Expo development build token by token; (2) `expo/fetch` reads it on both platforms;
(3) the round trip under a cold start stays under two seconds to first token.

**If it fails**, fall back to a plain Convex action that returns the finished reply. A stylist takes
three to eight seconds to compose a look; the chat component already renders a pending message, so
the screen is honest either way and nothing in the UI has to change. Streaming is a better
experience, not a requirement.

---

## 5. Try-on and wardrobe

Neither needs new server work. Both already exist on the deployment this document just chose.

- **Wardrobe** is `items.list`, `items.update`, `items.markWorn` and the outfit functions. Circle's
  wardrobe screens read the same rows the web app writes — **this one is wired already**:
  `circle/lib/wardrobe.ts` binds `useWardrobe()` to the fixtures or to `items:list` from what the
  build was given, and the grid and the piece screen call it without knowing which. It is the proof
  that the seam holds; the rest of the screens follow the same shape.
- **Capture** is `uploads.generateUploadUrl` plus the extraction job. `expo-image-picker` supplies
  the file; everything after that is the pipeline that runs today.
- **Try-on** is `renders.*` over `convex/ai/*`. The member's photo, the piece, a job the app watches
  with a realtime query. The job stepper in `components/common/` on the web has its counterpart in
  Circle's `PreviewStage`.

**On the hosted web preview specifically:** all three work, once the build is given the two keys.
`expo-image-picker` falls back to a file input on web, and browsers have had streaming `fetch` for
years — so the _web_ preview can have the stylist before the native app does. The streaming problem
in §4 is a React Native problem, not a Circle problem.

Two cautions before pointing a public URL at a real deployment. A preview anyone can open should use
the development deployment, not production, because a stranger who signs in gets a real member row
and a real seeded capsule. And previews spend real credits and real model calls against
`MAX_DAILY_SPEND_USD`.

---

## 6. Members styling each other

Indyx puts "get styled by friends and other Indyx users" behind its paid tier, and the plan mirrors
Indyx's free/paid split. Here is what it should mean for a house that already employs stylists.

**One mechanism, two uses.** Sending a look to your clothier and sending it to a friend are the same
act: a look gets a token, the token becomes a link, whoever opens it can propose changes back. The
clothier is a member with a staff flag, so the house does not build a private feature and a social
feature — it builds one and flags one participant.

```
looks/[lookId] ──"Ask someone"──▶ shares row {lookId, token, scope, expiresAt}
                                       │
             nyonicircle://look/<token> │  https://…/look/<token>  (opens the app, or the store)
                                       ▼
                              the other member opens it
                                       │
                         proposes a swap ──▶ lookProposals row
                                       ▼
                           the owner sees it on the look and accepts or not
```

**Rules worth fixing now.** Sharing is per look and opt-in — there is no member directory and no
follow graph in v1. A token is revocable and expires. A proposal never edits the owner's look; it
sits beside it until accepted. A shared link always opens, so an invitation from a member works for
someone who has not subscribed; what Atelier gates is _discovery_ — browsing other members' looks
rather than opening one you were sent.

**Cost:** about two weeks, and it is a v1.1 candidate rather than v1. Social features generate
support load and moderation questions that a first release does not need, and the journey the
product is built around — discover, style, preview, buy, save — is complete without it. Adding it to
v1 pushes the 20–24 week estimate to 22–26.

---

## 7. The hosted preview

`https://web-preview-production-240f.up.railway.app` serves the Expo web export from
`circle/server.mjs`, redeployed from `claude/gallant-wozniak-adxpmm` on every push.

**What it is.** Every screen, every state, on a URL anyone can open — enough to review the design,
walk the journey and show it to someone without a device build.

**What it is not.** React Native Web gets the layout right and tells you nothing about camera, push
notifications, in-app purchase, haptics or the native navigation feel. A screen that looks right
here still has to be looked at on a phone. It is a review aid, which is why the export carries
`x-robots-tag: noindex`.

**To turn on real sign-in**, set one variable on the Railway service and let it rebuild:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_test_…      (the same value the web app uses)
```

**To turn on the real wardrobe and membership**, add:

```
EXPO_PUBLIC_CONVEX_URL = https://accomplished-lemur-843.convex.cloud
```

Both are inlined by Metro at bundle time, so they are build variables and changing one means a
rebuild. `pnpm build` passes `--clear` for exactly this reason: without it Metro reuses a bundle
built with the old values and ignores the new ones silently.

---

## 8. What is still open

1. **One deployment or two** (§1) — the only decision here that reverses the plan, and the only one
   worth a signature before M1.
2. **Atelier's price and final name** — D9 of the plan. Needed before M7 because store products and
   localised pricing tiers depend on it.
3. **Stylist or concierge** — `docs/01-brand-brief.md` says the house says concierge and never
   stylist; `docs/06-frontend-style-guide.md` says "The Nyoni stylist" and the app is built that
   way. One of the two documents is wrong and the copy deck should settle it.
4. **A read-write WooCommerce key with a named owner** — needed at M4 to create orders server-side.
5. **Account deletion** (§2) — required by the App Store before submission.
6. **Rotate the keys pasted into chat during setup** — the Clerk secret, the OpenRouter key, the
   Convex deploy key, the AI Gateway key and the Vercel token. Everything above works with rotated
   values; none of them are in this repository.
