---
name: mobile-design-flows
description: "Translate a mobile product plan into screen flows, design tokens, state specifications, and implementation-ready visual references. Use for mobile UX planning, AI design prompts, or preparing consistent screen references before implementation."
---

# Mobile App Design Flows

Design the agreed product journey before polishing isolated screens. Read `references/fitness-example.md` for the fitness app's screen map and a reusable design prompt.

## Workflow

1. Read the plan, brand material, existing screens, and platform constraints. Identify the primary user action and the information needed to make that decision.
2. Map navigation and transitions for the critical journey. Identify public, authenticated, and paid states. Treat an upload/payment/access error as part of the flow rather than an afterthought.
3. Define a small written design system: color roles, typography, spacing, controls, navigation, media ratios, accessibility behavior, and state treatments. Record exact values in text; a generated image is not a dependable source of measurements or copy.
4. Produce a screen overview and detailed references for the few screens that establish the visual language. When alternatives would resolve a real design choice, generate a small set and explain the tradeoff. Do not repeatedly generate every screen if established components suffice.
5. Build each image-generation prompt from the actual plan: audience, task, screens, components, exact essential copy, state, layout, and brand constraints. Use the available image generation tool for requested raster generation or edits. Use existing design tools for editable layouts when requested; do not claim a static image is an interactive prototype.
6. Separate illustrations and icons from screenshots. Use authorized content or clearly labeled fictional fixtures. Do not invent real creators, testimonials, earnings, or transformation claims.
7. Hand off each screen with its route, components, content model, actions, states, and acceptance criteria. State what must match a reference and where native behavior takes priority. Use platform navigation appropriate to the chosen targets; the video's native-tab preference is not a universal rule.

## Output

Return a flow map or compact screen table, design tokens, key screen specifications, and reference-generation prompts or generated references when requested. Link actual artifacts only if created. Include loading, empty, error, locked, and success states relevant to the requested flow.

## Completion check

Walk the main journey without verbal rescue. Verify that price, billing period, membership scope, and free-versus-paid content are understandable. Check readable contrast, large-text layouts, labels for assistive technology, touch targets, safe areas, and keyboard behavior. Describe visual validation still needed on a running app; do not infer runtime usability from a beautiful mockup.
