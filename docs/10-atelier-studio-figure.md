# The studio figure

`src/components/atelier/studio/suit-figure.tsx` (`SuitFigure`) with its weave overlays in `cloth-pattern.tsx`. This note cannot live beside the component: the development bundler pulls any Markdown in that directory into the bundle.

The studio illustration: a tailor's croquis of a standing man wearing the suit a `SuitSpec` describes.
Server-safe (no hooks, no `"use client"`), one `<svg role="img">` in a 600 × 1000 viewBox that fills its
container's height (`h-full w-auto max-w-full`, `preserveAspectRatio="xMidYMid meet"`). The stage wraps it
in an `aspect-[3/5] h-full` box; the entry hero and the shared-design page give it a fixed-height box.

## Props

| Prop        | Type                       | Draws                                                                                                        |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `spec`      | `SuitSpec`                 | Every exterior choice (see below). Canvas, lining, button material and monogram do not.                      |
| `hex`       | `string \| null`           | The cloth's representative shade. `null` fills with `--muted` and dashes the main pieces: "no cloth chosen". |
| `pattern`   | `ClothPattern` (`"solid"`) | A tonal weave overlay from `cloth-pattern.tsx`; ignored while `hex` is null.                                 |
| `view`      | `"front" \| "back"`        | Back view shows vents, centre seam and collar; front shows everything else.                                  |
| `className` | `string`                   | Merged onto the `<svg>`.                                                                                     |
| `title`     | `string`                   | Replaces the generated sentence used for `aria-label` and `<title>`.                                         |

## What each spec choice changes

- `garment`: `three_piece` draws the waistcoat in the jacket's V; `tuxedo` fills lapels, collar, buttons,
  jetted pocket jets and the trouser outseam braid in the satin tone, and swaps the tie for a bow tie,
  bib pleats and studs.
- `jacket.breast`: `double` overlaps the wearer's left front across to a front edge 62 units left of
  centre, with two button columns; the under lapel's peak shows beyond the edge.
- `jacket.buttons`: one / two / three set the top button (where the lapel roll ends) and the last button
  (where single-breasted quarters cut away); `four_by_two` and `six_by_two` set two columns, the latter
  with a wider show row.
- `jacket.lapel` + `lapelWidth`: notch, peak and shawl geometry; width is the distance from the roll line
  to the lapel point (31 / 41 / 51 units ≈ 7 / 9 / 11 cm).
- `jacket.pockets`: flap, jetted (two welts) or patch; `ticketPocket` adds a ticket pocket above the
  wearer's right hip pocket, cut in the hip pockets' style: a small flap on a flap-pocket jacket, two short
  welts on a jetted one (a patch-pocket jacket takes none).
- `jacket.vents` (back view): none, a centre vent or two side vents.
- `jacket.shoulder`: `roped` lifts the sleeve head 6 units and adds a rope line.
- `jacket.sleeveButtons` / `workingCuffs`: four or five cuff buttons, with buttonhole ticks when working.
- `trousers.fit`: knee and hem width; `pleats`: one or two pleat lines running into the crease; `rise`:
  the waistband's height (mid 440, high 424), which shows with the fly in the jacket's open quarters below
  the last button; `hem`: a cuff band; `waistband`: belt loops (the inner pair flanks the fly, so one shows
  in the quarters) or a clean waist.
- `waistcoat.style` / `lapel`: five or six single-breasted buttons with a V, or a double-breasted front
  whose overlap closes high and carries three rows of paired buttons, the first pair in the V of a one- or
  two-button jacket; `shawl` adds the rolled edge on either style (inboard of the overlap on the
  double-breasted one). Under a six-by-two jacket only a sliver of any waistcoat shows, as in life.

## Drawing system

Landmarks are constants at the top of `suit-figure.tsx`; every path is built from `P(dx, y)`, an offset
from the centre line. The two fronts are separate pieces whose top edge is the lapel roll line, so the
shirt, tie and waistcoat beneath show in the V and in the open quarters without clipping. The shirt body is
painted before the trousers, so the waistband sits over it. The shirt, the trouser waist and the ticket pocket
all stay inside the jacket's side seams, so only the page shows in the gap between body and sleeve.
`Piece` paints shade, weave overlay and outline; `detail` pieces
(pockets, welt, collar, cuff) never take the dashed "no cloth" outline.

Two inks. Edges that meet the page (the silhouette, head, hands, shirt, shoes) are `currentColor`. Every
stroke that lies on the cloth is the cloth's own tonal ink, `tonalEdge(hex)` from `cloth-pattern.tsx`: the
shade lifted or deepened by about half, whichever contrasts more, so a midnight navy's lapel edges, pocket
jets, dart, vents and buttons stay legible in the light theme (ink `#080808`) as well as the dark. In code
that is `Seam` (a hairline in `cloth.edge`) and `Piece edge="cloth"` (lapels, collar, waistcoat, details);
the fronts, sleeves, trouser legs and back torso keep `currentColor` outlines and add a `Seam` where their
edge lies on other cloth (hem, front edge, sleeve inner edge and armhole). With no cloth both inks are
`currentColor`. All strokes use `vector-effect: non-scaling-stroke`, so hairlines stay hairlines at 360 px
and at 900 px. `patternInk` and `satinTone` keep weave overlays and tuxedo facings tonal to the cloth. The
render harness for comparing specs side by side lives outside the repo.
