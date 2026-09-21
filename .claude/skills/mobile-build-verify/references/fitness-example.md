# Source and fitness application

User-provided transcript: Pasted markdown(20260918-070742).md, reviewed 18 September 2026. The source describes an Instagram-style Expo tutorial; the fitness marketplace examples below are adaptations, not claims made in the video.

## Transcript mapping

Chapter 5, “Completing Our App” (lines 2133–2402), plus the screenshot comparison and review workflow in Chapter 3. Transfer one-feature-at-a-time work, screenshot feedback, reusable workflows, settings, and durable project conventions. Improve the video's unlimited matching loop and its suggestion to skip waiting for a new review after review fixes.

## Proposed build slices

1. Public creator channel with one real free sample and a usable shared link.
2. Creator program editor: upload, draft, preview, publish; prove another creator cannot edit it.
3. Paid membership purchase, verified entitlement, and protected program access.
4. Workout session: playback/instructions and completion persisted per member.
5. Creator sale/earnings attribution and membership management.
6. Settings, account lifecycle, support, applicable content reporting, and release checks.

Treat these as a suggested order; adjust for dependency findings. The first four form the smallest meaningful member experience. Build sketches or static screens are not proof of monetization.

## Example request

“Implement the workout-session screen from the reference and current plan. Members with access to the creator can play the video, read exercise instructions, and complete the session. Save completion to their account. Keep the existing navigation. Compare the rendered screen with the reference, fix material mismatches, and report the checks you actually ran.”

Expected verification: free/member/locked states show appropriate actions; long exercise names and larger text do not hide controls; video failure has a retry path; completion survives relaunch; tapping completion twice does not double-count; another member cannot alter this progress; back navigation still works. If no simulator is available, report the visual/device checks as outstanding.

Example durable project conventions, only after adopted: premium media access is issued by the server; one membership belongs to one creator; fixtures cannot enter production creator counts; use the existing design tokens and agreed navigation. These are more useful for this app than importing an Instagram feature list.
