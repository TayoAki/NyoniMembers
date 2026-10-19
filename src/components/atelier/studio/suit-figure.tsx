import type { ClothPattern } from "@convex/shared/atelier/enums";
import { CLOTH_PATTERN_LABELS } from "@convex/shared/atelier/enums";
import {
  BREAST_OPTIONS,
  BUTTON_STANCE_OPTIONS,
  GARMENT_OPTIONS,
  HEM_OPTIONS,
  LAPEL_OPTIONS,
  LAPEL_WIDTH_OPTIONS,
  PLEAT_OPTIONS,
  POCKET_OPTIONS,
  TROUSER_FIT_OPTIONS,
  VENT_OPTIONS,
  WAISTCOAT_STYLE_OPTIONS,
  specHash,
  type ButtonStance,
  type Lapel,
  type LapelWidth,
  type Option,
  type Rise,
  type SuitSpec,
  type TrouserFit,
} from "@convex/shared/atelier/spec";
import { cn } from "@/lib/utils";
import { ClothPatternDef, clothPatternId, patternInk, satinTone, tonalEdge } from "./cloth-pattern";

export type SuitFigureView = "front" | "back";

export type SuitFigureProps = {
  spec: SuitSpec;
  /** The cloth's representative shade; null draws the "no cloth chosen" state. */
  hex: string | null;
  pattern?: ClothPattern;
  view?: SuitFigureView;
  className?: string;
  /** Overrides the generated description used for `aria-label` and `<title>`. */
  title?: string;
};

/*
 * The studio illustration: a tailor's croquis of a standing man in the suit the spec describes, drawn in two
 * inks. Edges that meet the page (the silhouette, head, hands, shirt) are hairlines of `currentColor`, so the
 * figure sits on onyx and on cream alike; every stroke that lies on the cloth (lapel and front edges, seams,
 * pockets, vents, buttons) is in `tonalEdge(hex)`, the cloth's own shade lifted or deepened, so a midnight
 * navy keeps its details in the light theme as well as the dark. With no cloth chosen both inks are
 * `currentColor`. The only fills are the cloth (the representative shade, with a tonal weave overlay), the
 * shirt, the shoes and the page colour behind the head and hands. Every choice in the spec that shows on the
 * outside of a suit changes the drawing; canvas, lining, the buttons' material and the monogram are interior
 * and do not.
 *
 * Coordinates are in a 600 × 1000 viewBox, about eight and a half heads tall. `dx` values are offsets
 * from the centre line (x = 300); positive is the viewer's right, which is the wearer's left. Strokes
 * use `non-scaling-stroke`, so the hairlines stay hairlines whether the figure is 360 or 900 px tall.
 */

const CX = 300;
const LINE = 1.1;
const FINE = 0.85;
const DASH = "5 4";
const SHIRT = "#F7F3EA";
const SHIRT_LINE = "#8A8172";
const INK = "#2A2622";
const SHOE = "#15120F";
const PAGE = "var(--background)";

const r1 = (v: number) => Math.round(v * 10) / 10;
const P = (dx: number, y: number) => `${r1(CX + dx)} ${r1(y)}`;

type Side = 1 | -1;
const SIDES: readonly Side[] = [-1, 1];

/* ---------- landmarks of the croquis ---------- */

const HEAD_TOP = 40;
const CHIN_Y = 146;
const NECK_Y = 198;
const NECK_DX = 30;
const SHOULDER_DX = 114;
const SHOULDER_Y = 216;
const WAIST_DX = 84;
const WAIST_Y = 382;
const HEM_DX = 100;
const HEM_Y = 530;
const QUARTER_DX = 56;
const CUFF_Y = 546;
const HIP_DX = 104;
const KNEE_Y = 745;
const TROUSER_HEM_Y = 918;
const LEG_CENTER = 50;
const DB_EDGE = 62;
const GORGE_DX = 34;
const GORGE_Y = 230;

const LAPEL_W: Record<LapelWidth, number> = { slim: 31, standard: 41, wide: 51 };
const LEG_HALF: Record<TrouserFit, { knee: number; hem: number }> = {
  classic: { knee: 44, hem: 42 },
  tailored: { knee: 40, hem: 35 },
  slim: { knee: 35, hem: 29 },
};
/** The top of the trouser waistband; it shows in the jacket's open quarters, so the rise moves it. */
const WAISTBAND_Y: Record<Rise, number> = { mid: 440, high: 424 };

type Stance = {
  /** Button rows, top first. */
  rows: number[];
  /** Columns for a double-breasted front; a single column at the centre otherwise. */
  columns: number[];
  /** Where the lapel roll ends: the top fastening button. */
  yTop: number;
  /** The lowest fastening button, where single-breasted quarters begin to open. */
  yLast: number;
  showRow: { y: number; dx: number } | null;
};

function stanceOf(buttons: ButtonStance): Stance {
  switch (buttons) {
    case "one":
      return { rows: [392], columns: [0], yTop: 392, yLast: 392, showRow: null };
    case "two":
      return { rows: [372, 416], columns: [0], yTop: 372, yLast: 416, showRow: null };
    case "three":
      return { rows: [330, 372, 414], columns: [0], yTop: 330, yLast: 414, showRow: null };
    case "four_by_two":
      return { rows: [374, 428], columns: [-46, 46], yTop: 374, yLast: 428, showRow: null };
    case "six_by_two":
      return { rows: [374, 428], columns: [-44, 44], yTop: 374, yLast: 428, showRow: { y: 320, dx: 52 } };
  }
}

type ClothStyle = {
  fill: string;
  dashed: boolean;
  patternUrl: string | null;
  satin: string;
  satinOpacity: number;
  /** The ink for strokes that lie on the cloth; `currentColor` when no cloth is chosen. */
  edge: string;
};

/* ---------- primitives ---------- */

type HairlineProps = {
  d: string;
  opacity?: number;
  width?: number;
  dash?: string;
  color?: string;
};

function Hairline({ d, opacity = 1, width = LINE, dash, color = "currentColor" }: HairlineProps) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeDasharray={dash}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A hairline that lies on the cloth (a seam, an edge, a crease), in the cloth's own tonal ink. */
function Seam({ cloth, ...rest }: Omit<HairlineProps, "color"> & { cloth: ClothStyle }) {
  return <Hairline {...rest} color={cloth.edge} />;
}

/**
 * A piece of cloth: shade, weave overlay, then the hairline outline on top. The outline is `currentColor`
 * where the piece's edges meet the page and the cloth's tonal ink where they lie on other cloth; a `detail`
 * (pocket, welt, collar) lies on cloth unless told otherwise and never takes the dashed "no cloth chosen"
 * outline, so the figure does not dissolve into dashes.
 */
function Piece({
  d,
  cloth,
  satin = false,
  outline = 1,
  detail = false,
  edge = detail ? "cloth" : "page",
}: {
  d: string;
  cloth: ClothStyle;
  satin?: boolean;
  outline?: number;
  detail?: boolean;
  edge?: "page" | "cloth";
}) {
  return (
    <>
      {satin ? (
        <path d={d} fill={cloth.satin} fillOpacity={cloth.satinOpacity} stroke="none" />
      ) : (
        <>
          <path d={d} fill={cloth.fill} stroke="none" />
          {cloth.patternUrl ? <path d={d} fill={cloth.patternUrl} stroke="none" /> : null}
        </>
      )}
      <Hairline
        d={d}
        opacity={detail ? outline * 0.8 : outline}
        dash={cloth.dashed && !detail ? DASH : undefined}
        color={edge === "cloth" ? cloth.edge : "currentColor"}
      />
    </>
  );
}

/** A quiet neutral: shirt, shoe or the page colour standing in for skin. */
function Quiet({ d, fill, outline = 0.85, color }: { d: string; fill: string; outline?: number; color?: string }) {
  return (
    <>
      <path d={d} fill={fill} stroke="none" />
      {outline > 0 ? <Hairline d={d} opacity={outline} color={color} /> : null}
    </>
  );
}

function Button({
  dx,
  y,
  r = 4,
  cloth,
  satin = false,
}: {
  dx: number;
  y: number;
  r?: number;
  cloth: ClothStyle;
  satin?: boolean;
}) {
  return (
    <circle
      cx={r1(CX + dx)}
      cy={r1(y)}
      r={r}
      fill={satin ? cloth.satin : cloth.edge}
      fillOpacity={satin ? cloth.satinOpacity : 0.45}
      stroke={cloth.edge}
      strokeWidth={FINE}
      strokeOpacity={0.9}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/* ---------- shared geometry ---------- */

/** The jacket's side from the shoulder point down to the hem on side `s`, as a path fragment. */
function sideDown(s: Side): string {
  return `C ${P(s * 116, 262)} ${P(s * 92, 330)} ${P(s * WAIST_DX, WAIST_Y)} C ${P(s * 80, 430)} ${P(s * 98, 486)} ${P(s * HEM_DX, HEM_Y)}`;
}

/** The same side from the hem back up to the shoulder point. */
function sideUp(s: Side): string {
  return `C ${P(s * 98, 486)} ${P(s * 80, 430)} ${P(s * WAIST_DX, WAIST_Y)} C ${P(s * 92, 330)} ${P(s * 116, 262)} ${P(s * SHOULDER_DX, SHOULDER_Y)}`;
}

function shoulderOut(s: Side): string {
  return `Q ${P(s * 74, 200)} ${P(s * SHOULDER_DX, SHOULDER_Y)}`;
}

function shoulderIn(s: Side, neckY: number): string {
  return `Q ${P(s * 74, 200)} ${P(s * NECK_DX, neckY)}`;
}

const HEAD_D = `M ${P(-37, 94)} C ${P(-38, 60)} ${P(-24, HEAD_TOP)} ${P(0, HEAD_TOP)} C ${P(24, HEAD_TOP)} ${P(38, 60)} ${P(37, 94)} C ${P(36, 122)} ${P(20, CHIN_Y)} ${P(0, CHIN_Y)} C ${P(-20, CHIN_Y)} ${P(-36, 122)} ${P(-37, 94)} Z`;
const NECK_D = `M ${P(-20, 130)} C ${P(-21, 160)} ${P(-25, 184)} ${P(-27, 204)} L ${P(27, 204)} C ${P(25, 184)} ${P(21, 160)} ${P(20, 130)} Z`;

function Head({ view }: { view: SuitFigureView }) {
  const hair =
    view === "front"
      ? `M ${P(-37, 92)} C ${P(-38, 60)} ${P(-24, HEAD_TOP)} ${P(0, HEAD_TOP)} C ${P(24, HEAD_TOP)} ${P(38, 60)} ${P(37, 92)} C ${P(32, 78)} ${P(16, 68)} ${P(0, 68)} C ${P(-16, 68)} ${P(-32, 78)} ${P(-37, 92)} Z`
      : `M ${P(-37, 94)} C ${P(-38, 60)} ${P(-24, HEAD_TOP)} ${P(0, HEAD_TOP)} C ${P(24, HEAD_TOP)} ${P(38, 60)} ${P(37, 94)} C ${P(36, 110)} ${P(22, 122)} ${P(0, 124)} C ${P(-22, 122)} ${P(-36, 110)} ${P(-37, 94)} Z`;
  return (
    <>
      <Quiet d={NECK_D} fill={PAGE} outline={0.8} />
      <path d={HEAD_D} fill={PAGE} stroke="none" />
      <path d={hair} fill="currentColor" fillOpacity={0.12} stroke="none" />
      <Hairline d={HEAD_D} />
      <Hairline d={hair} opacity={0.4} width={FINE} />
      {view === "front" ? (
        <Hairline
          d={`M ${P(-37, 100)} C ${P(-41, 100)} ${P(-42, 112)} ${P(-37, 114)} M ${P(37, 100)} C ${P(41, 100)} ${P(42, 112)} ${P(37, 114)}`}
          opacity={0.6}
          width={FINE}
        />
      ) : null}
    </>
  );
}

/** A relaxed hand below the cuff; the thumb lies against the trouser on the front view. */
function Hand({ s, view }: { s: Side; view: SuitFigureView }) {
  const c = s * 106;
  const o = (dx: number) => c + s * dx;
  const d =
    view === "front"
      ? `M ${P(o(-19), 552)} L ${P(o(19), 552)} C ${P(o(22), 578)} ${P(o(19), 602)} ${P(o(10), 614)} C ${P(o(2), 621)} ${P(o(-9), 618)} ${P(o(-13), 608)} C ${P(o(-21), 598)} ${P(o(-24), 574)} ${P(o(-19), 552)} Z`
      : `M ${P(o(-19), 552)} L ${P(o(19), 552)} C ${P(o(21), 578)} ${P(o(19), 602)} ${P(o(10), 614)} C ${P(o(2), 621)} ${P(o(-10), 618)} ${P(o(-14), 608)} C ${P(o(-20), 596)} ${P(o(-21), 574)} ${P(o(-19), 552)} Z`;
  return (
    <>
      <Quiet d={d} fill={PAGE} outline={0.85} />
      {view === "front" ? (
        <Hairline
          d={`M ${P(o(-17), 560)} C ${P(o(-11), 572)} ${P(o(-10), 586)} ${P(o(-13), 596)}`}
          opacity={0.4}
          width={FINE}
        />
      ) : null}
      <Hairline
        d={`M ${P(o(3), 620)} L ${P(o(3), 604)} M ${P(o(-5), 617)} L ${P(o(-5), 603)} M ${P(o(11), 614)} L ${P(o(11), 600)}`}
        opacity={0.4}
        width={FINE}
      />
    </>
  );
}

function Sleeve({
  s,
  cloth,
  roped,
  buttons,
  working,
}: {
  s: Side;
  cloth: ClothStyle;
  roped: boolean;
  buttons: number;
  working: boolean;
}) {
  const lift = roped ? 6 : 0;
  const top = SHOULDER_Y - lift;
  // The sleeve head leaves the shoulder seam on its own tangent, so the two read as one line.
  const innerUp = `C ${P(s * 87, 500)} ${P(s * 89, 432)} ${P(s * 90, 400)} C ${P(s * 90, 350)} ${P(s * 86, 300)} ${P(s * 84, 264)} C ${P(s * 87, 240)} ${P(s * 96, top)} ${P(s * 106, top - 5)}`;
  const inner = `M ${P(s * 86, CUFF_Y)} ${innerUp}`;
  const d = `M ${P(s * 106, top - 5)} C ${P(s * 120, top - 1)} ${P(s * 132, 240)} ${P(s * 137, 330)} C ${P(s * 139, 400)} ${P(s * 131, 470)} ${P(s * 127, CUFF_Y)} L ${P(s * 86, CUFF_Y)} ${innerUp} Z`;
  const cuff = `M ${P(s * 86, CUFF_Y - 6)} L ${P(s * 127, CUFF_Y - 6)} L ${P(s * 125, CUFF_Y + 7)} L ${P(s * 88, CUFF_Y + 7)} Z`;
  return (
    <>
      <Quiet d={cuff} fill={SHIRT} outline={0.6} color={SHIRT_LINE} />
      <Piece d={d} cloth={cloth} />
      {/* the inner edge and armhole lie on the body, so they take the cloth's ink */}
      <Seam d={inner} cloth={cloth} />
      {roped ? (
        <Seam
          d={`M ${P(s * 100, 218 - lift)} Q ${P(s * 116, 206 - lift)} ${P(s * 126, 230)}`}
          cloth={cloth}
          opacity={0.6}
          width={FINE}
        />
      ) : null}
      {Array.from({ length: buttons }, (_, i) => CUFF_Y - 12 - i * 9).map((y) => (
        <g key={y}>
          <Button dx={s * 116} y={y} r={2.6} cloth={cloth} />
          {working ? (
            <Seam d={`M ${P(s * 112, y)} L ${P(s * 106, y)}`} cloth={cloth} opacity={0.7} width={FINE} />
          ) : null}
        </g>
      ))}
    </>
  );
}

function Shoes({ view }: { view: SuitFigureView }) {
  return (
    <>
      {SIDES.map((s) => {
        const c = s * LEG_CENTER;
        const o = (dx: number) => c + s * dx;
        const d =
          view === "front"
            ? `M ${P(o(-24), 910)} L ${P(o(24), 910)} C ${P(o(31), 926)} ${P(o(36), 946)} ${P(o(28), 956)} C ${P(o(16), 963)} ${P(o(-8), 963)} ${P(o(-19), 957)} C ${P(o(-28), 951)} ${P(o(-29), 928)} ${P(o(-24), 910)} Z`
            : `M ${P(o(-23), 910)} L ${P(o(23), 910)} C ${P(o(27), 928)} ${P(o(27), 948)} ${P(o(19), 955)} L ${P(o(-19), 955)} C ${P(o(-27), 948)} ${P(o(-27), 928)} ${P(o(-23), 910)} Z`;
        return (
          <g key={s}>
            <path d={d} fill={SHOE} stroke="none" />
            <Hairline d={d} opacity={0.55} />
            {view === "front" ? (
              <>
                <Hairline
                  d={`M ${P(o(-26), 936)} C ${P(o(-12), 946)} ${P(o(14), 948)} ${P(o(31), 936)}`}
                  opacity={0.3}
                  width={FINE}
                />
                <Hairline
                  d={`M ${P(o(-27), 950)} C ${P(o(-10), 960)} ${P(o(16), 960)} ${P(o(33), 948)}`}
                  opacity={0.25}
                  width={FINE}
                />
              </>
            ) : (
              <Hairline d={`M ${P(o(-26), 940)} L ${P(o(26), 940)}`} opacity={0.3} width={FINE} />
            )}
          </g>
        );
      })}
    </>
  );
}

function Trousers({
  spec,
  cloth,
  view,
  tuxedo,
}: {
  spec: SuitSpec;
  cloth: ClothStyle;
  view: SuitFigureView;
  tuxedo: boolean;
}) {
  const { fit, pleats, rise, hem, waistband } = spec.trousers;
  const half = LEG_HALF[fit];
  const yWB = WAISTBAND_Y[rise];
  const front = view === "front";
  const cuffTop = TROUSER_HEM_Y - 20;
  return (
    <>
      {SIDES.map((s) => {
        const c = s * LEG_CENTER;
        const outKnee = c + s * half.knee;
        const inKnee = c - s * half.knee;
        const outHem = c + s * half.hem;
        const inHem = c - s * half.hem;
        const leg = `M ${P(0, yWB)} L ${P(s * HIP_DX, yWB)} C ${P(s * (HIP_DX + 2), 580)} ${P(outKnee + s * 2, 670)} ${P(outKnee, KNEE_Y)} C ${P(outKnee - s, 810)} ${P(outHem, 870)} ${P(outHem, TROUSER_HEM_Y)} L ${P(inHem, TROUSER_HEM_Y)} C ${P(inHem, 870)} ${P(inKnee - s, 810)} ${P(inKnee, KNEE_Y)} C ${P(inKnee + s * 2, 690)} ${P(s * 6, 620)} ${P(0, 568)} Z`;
        const creaseTop = front ? (pleats === "flat" ? 600 : yWB + 14) : 640;
        return (
          <g key={s}>
            <Piece d={leg} cloth={cloth} />
            <Seam
              d={`M ${P(c, hem === "cuffed" ? cuffTop : TROUSER_HEM_Y - 2)} L ${P(c, creaseTop)}`}
              cloth={cloth}
              opacity={0.55}
              width={FINE}
            />
            {front && pleats !== "flat" ? (
              <Seam
                d={`M ${P(c - s * 3, yWB + 14)} L ${P(c - s * 3, 540)} C ${P(c - s * 2, 570)} ${P(c, 590)} ${P(c, 604)}`}
                cloth={cloth}
                opacity={0.75}
                width={FINE}
              />
            ) : null}
            {front && pleats === "double" ? (
              <Seam
                d={`M ${P(c + s * 14, yWB + 14)} C ${P(c + s * 14, 520)} ${P(c + s * 13, 548)} ${P(c + s * 12, 572)}`}
                cloth={cloth}
                opacity={0.7}
                width={FINE}
              />
            ) : null}
            {tuxedo ? (
              <path
                d={`M ${P(s * (HIP_DX - 2), 540)} C ${P(s * HIP_DX, 590)} ${P(outKnee, 670)} ${P(outKnee - s * 2, KNEE_Y)} C ${P(outKnee - s * 3, 810)} ${P(outHem - s * 2, 870)} ${P(outHem - s * 2, TROUSER_HEM_Y - 1)}`}
                fill="none"
                stroke={cloth.satin}
                strokeOpacity={cloth.satinOpacity}
                strokeWidth={2.6}
              />
            ) : null}
            {hem === "cuffed" ? (
              <>
                <Piece
                  d={`M ${P(outHem + s * 2, cuffTop)} L ${P(outHem + s * 2, TROUSER_HEM_Y)} L ${P(inHem - s * 2, TROUSER_HEM_Y)} L ${P(inHem - s * 2, cuffTop)} Z`}
                  cloth={cloth}
                  detail
                  edge="page"
                />
                <Seam
                  d={`M ${P(outHem + s * 2, cuffTop)} L ${P(inHem - s * 2, cuffTop)}`}
                  cloth={cloth}
                  opacity={0.8}
                />
              </>
            ) : null}
          </g>
        );
      })}
      {front ? (
        <>
          <Seam
            d={`M ${P(-HIP_DX, yWB)} L ${P(HIP_DX, yWB)} M ${P(-HIP_DX, yWB + 14)} L ${P(HIP_DX, yWB + 14)}`}
            cloth={cloth}
            opacity={0.8}
            width={FINE}
          />
          <Seam
            d={`M ${P(2, yWB + 14)} C ${P(3, yWB + 40)} ${P(3, yWB + 70)} ${P(1, yWB + 100)}`}
            cloth={cloth}
            opacity={0.6}
            width={FINE}
          />
          {/* the inner pair flanks the fly, where the open quarters let the waistband show */}
          {waistband === "belt_loops"
            ? SIDES.map((s) => (
                <Seam
                  key={s}
                  d={`M ${P(s * 6, yWB - 2)} L ${P(s * 6, yWB + 17)} M ${P(s * 11, yWB - 2)} L ${P(s * 11, yWB + 17)} M ${P(s * 62, yWB - 2)} L ${P(s * 62, yWB + 17)} M ${P(s * 68, yWB - 2)} L ${P(s * 68, yWB + 17)}`}
                  cloth={cloth}
                  opacity={0.9}
                  width={FINE}
                />
              ))
            : null}
        </>
      ) : null}
    </>
  );
}

/* ---------- jacket front ---------- */

type LapelShapes = {
  /** Path fragment from the front edge at `yTop` up the roll line to the collar; the torso's V edge. */
  roll: string;
  lapel: string;
  collar: string | null;
};

/**
 * The lapel on side `s`. The roll line runs from the front edge (the centre on a single-breasted front,
 * the overlapping edge on a double-breasted one) up to the gorge beside the neck; the lapel lies outboard
 * of it, its free edge curving from the same point up to the notch or peak, and the collar end sits above.
 */
function lapelShapes(s: Side, lapel: Lapel, w: number, yTop: number, edgeDx: number): LapelShapes {
  const E = P(edgeDx, yTop);
  const gx = s * GORGE_DX;
  /** A point a fraction `t` of the way up the roll line, pushed `out` units outboard. */
  const along = (fromDx: number, fromY: number, toDx: number, toY: number, t: number, out: number) =>
    P(fromDx + (toDx - fromDx) * t + s * out, fromY + (toY - fromY) * t);
  if (lapel === "shawl") {
    const neckY = 204;
    const G = P(s * 30, neckY);
    const ctrl = along(edgeDx, yTop, s * 30, neckY, 0.5, -8);
    const roll = `Q ${ctrl} ${G}`;
    // The shawl is widest over the chest and narrows into the collar at the neck and into the edge at the button.
    const outer = `C ${P(s * (40 + w * 0.4), 192)} ${P(s * (30 + w * 0.72), 238)} ${along(edgeDx, yTop, s * 30, neckY, 0.56, w * 0.95)} C ${along(edgeDx, yTop, s * 30, neckY, 0.3, w * 0.8)} ${along(edgeDx, yTop, s * 30, neckY, 0.08, w * 0.3)} ${E}`;
    return { roll, lapel: `M ${E} ${roll} ${outer} Z`, collar: null };
  }
  const G = P(gx, GORGE_Y);
  const ctrl = along(edgeDx, yTop, gx, GORGE_Y, 0.5, -8);
  const roll = `Q ${ctrl} ${G}`;
  const peak = lapel === "peak";
  // N is the notch's inner corner on the gorge seam, L the lapel point, C the collar point above it.
  const N = peak ? [s * (GORGE_DX + w * 0.4), GORGE_Y + 10] : [s * (GORGE_DX + w * 0.56), GORGE_Y + 6];
  const L = peak ? [s * (GORGE_DX + w * 1.2), GORGE_Y - 18] : [s * (GORGE_DX + w * 1.0), GORGE_Y + 2];
  const C = peak ? [s * (GORGE_DX + w * 0.3), GORGE_Y - 6] : [s * (GORGE_DX + w * 0.74), GORGE_Y - 10];
  const b1 = along(edgeDx, yTop, L[0], L[1], 0.36, 3);
  const b2 = along(edgeDx, yTop, L[0], L[1], 0.76, 3);
  const lapelD = `M ${G} Q ${ctrl} ${E} C ${b1} ${b2} ${P(L[0], L[1])} L ${P(N[0], N[1])} Z`;
  const collarD = `M ${P(s * 26, 200)} L ${G} L ${P(N[0], N[1])} L ${P(C[0], C[1])} Q ${P(s * (GORGE_DX + w * 0.2), 206)} ${P(s * 30, 196)} Z`;
  return { roll, lapel: lapelD, collar: collarD };
}

function Pockets({ s, spec, cloth, tuxedo }: { s: Side; spec: SuitSpec; cloth: ClothStyle; tuxedo: boolean }) {
  const { pockets, ticketPocket } = spec.jacket;
  const a = s * 36;
  const b = s * 98;
  let pocket: React.ReactNode;
  if (pockets === "patch") {
    const d = `M ${P(a, 430)} L ${P(b, 430)} L ${P(b, 486)} Q ${P(b, 496)} ${P(b - s * 10, 496)} L ${P(a + s * 10, 496)} Q ${P(a, 496)} ${P(a, 486)} Z`;
    pocket = (
      <>
        <Piece d={d} cloth={cloth} detail />
        <Seam d={`M ${P(a, 438)} L ${P(b, 438)}`} cloth={cloth} opacity={0.6} width={FINE} />
      </>
    );
  } else if (pockets === "jetted") {
    const d = `M ${P(a, 440)} L ${P(b, 437)} M ${P(a, 445)} L ${P(b, 442)}`;
    pocket = (
      <>
        {tuxedo ? <Hairline d={d} opacity={cloth.satinOpacity} width={2} color={cloth.satin} /> : null}
        <Seam d={d} cloth={cloth} opacity={tuxedo ? 0.6 : 0.9} width={FINE} />
      </>
    );
  } else {
    pocket = (
      <Piece
        d={`M ${P(a, 438)} L ${P(b, 435)} L ${P(b, 451)} Q ${P(b, 455)} ${P(b - s * 4, 455)} L ${P(a + s * 4, 458)} Q ${P(a, 458)} ${P(a, 454)} Z`}
        cloth={cloth}
        detail
      />
    );
  }
  // The ticket pocket is cut in the hip pockets' style: two welts on a jetted jacket, a flap otherwise.
  const ticket =
    pockets === "jetted" ? (
      <Seam
        d={`M ${P(-96, 413)} L ${P(-62, 415)} M ${P(-96, 418)} L ${P(-62, 420)}`}
        cloth={cloth}
        opacity={0.9}
        width={FINE}
      />
    ) : (
      <Piece
        d={`M ${P(-96, 412)} L ${P(-62, 410)} L ${P(-62, 422)} Q ${P(-62, 425)} ${P(-65, 425)} L ${P(-93, 426)} Q ${P(-96, 426)} ${P(-96, 423)} Z`}
        cloth={cloth}
        detail
      />
    );
  return (
    <>
      {pocket}
      {ticketPocket && s === -1 ? ticket : null}
    </>
  );
}

function Waistcoat({ spec, cloth }: { spec: SuitSpec; cloth: ClothStyle }) {
  const wc = spec.waistcoat;
  if (!wc) return null;
  if (wc.style === "double") {
    // The wearer's right panel crosses to an edge 26 right of centre; the V closes high, at the crossing.
    const rows = [300, 340, 380];
    const body = `M ${P(-36, 214)} L ${P(-80, 236)} L ${P(-80, 470)} L ${P(80, 470)} L ${P(80, 236)} L ${P(36, 214)} L ${P(0, 257)} Z`;
    const edge = `M ${P(0, 257)} L ${P(26, 300)} L ${P(26, 470)}`;
    // The shawl rolls along both sides of the neck, inboard of the edges, into the edge below the top row.
    const shawl = `M ${P(-42, 218)} L ${P(20, 304)} Q ${P(21, 310)} ${P(26, 316)} M ${P(42, 218)} L ${P(4, 270)}`;
    return (
      <>
        <Piece d={body} cloth={cloth} edge="cloth" />
        <Seam d={edge} cloth={cloth} opacity={0.9} />
        {wc.lapel === "shawl" ? <Seam d={shawl} cloth={cloth} opacity={0.8} width={FINE} /> : null}
        {rows.map((y) => (
          <g key={y}>
            <Button dx={-11} y={y} r={3.2} cloth={cloth} />
            <Button dx={11} y={y} r={3.2} cloth={cloth} />
          </g>
        ))}
      </>
    );
  }
  const six = wc.style === "single_six";
  const first = six ? 290 : 302;
  const gap = six ? 27 : 30;
  const count = six ? 6 : 5;
  const neck = first - 8;
  const body = `M ${P(-36, 214)} L ${P(-80, 236)} L ${P(-80, 462)} L ${P(-16, 480)} L ${P(0, 460)} L ${P(16, 480)} L ${P(80, 462)} L ${P(80, 236)} L ${P(36, 214)} L ${P(0, neck)} Z`;
  return (
    <>
      <Piece d={body} cloth={cloth} edge="cloth" />
      <Seam d={`M ${P(0, neck)} L ${P(0, 458)}`} cloth={cloth} opacity={0.7} width={FINE} />
      {wc.lapel === "shawl"
        ? SIDES.map((s) => (
            <Seam
              key={s}
              d={`M ${P(s * 34, 222)} C ${P(s * 24, 236)} ${P(s * 12, neck - 2)} ${P(0, neck + 16)}`}
              cloth={cloth}
              opacity={0.85}
              width={FINE}
            />
          ))
        : null}
      {Array.from({ length: count }, (_, i) => first + i * gap).map((y) => (
        <Button key={y} dx={0} y={y} r={3.2} cloth={cloth} />
      ))}
    </>
  );
}

/**
 * The shirt body, drawn before the trousers so the waistband sits over it; it stays inside the jacket's
 * side seams (±84 at the waist) so no shirt shows between body and sleeve.
 */
const SHIRT_D = `M ${P(-40, 196)} L ${P(-96, 236)} L ${P(-96, 290)} L ${P(-78, 340)} L ${P(-78, 460)} L ${P(78, 460)} L ${P(78, 340)} L ${P(96, 290)} L ${P(96, 236)} L ${P(40, 196)} Z`;

/** Shirt collar, tie or bow tie; drawn under the jacket, which hides whatever lies below the top button. */
function ShirtFront({ spec, yTop }: { spec: SuitSpec; yTop: number }) {
  const tuxedo = spec.garment === "tuxedo";
  const band = `M ${P(-27, 186)} Q ${P(0, 179)} ${P(27, 186)} L ${P(27, 198)} Q ${P(0, 192)} ${P(-27, 198)} Z`;
  return (
    <>
      <Quiet d={band} fill={SHIRT} outline={0.7} color={SHIRT_LINE} />
      {SIDES.map((s) => (
        <Quiet
          key={s}
          d={`M ${P(s * 27, 190)} L ${P(s * 7, 202)} L ${P(s * 15, 230)} L ${P(s * 31, 212)} Z`}
          fill={SHIRT}
          outline={0.75}
          color={SHIRT_LINE}
        />
      ))}
      {tuxedo ? (
        <>
          <path
            d={`M ${P(-4, 200)} C ${P(-12, 195)} ${P(-25, 195)} ${P(-25, 201)} L ${P(-25, 213)} C ${P(-25, 219)} ${P(-12, 219)} ${P(-4, 214)} Z M ${P(4, 200)} C ${P(12, 195)} ${P(25, 195)} ${P(25, 201)} L ${P(25, 213)} C ${P(25, 219)} ${P(12, 219)} ${P(4, 214)} Z M ${P(-5, 199)} L ${P(5, 199)} L ${P(5, 215)} L ${P(-5, 215)} Z`}
            fill={INK}
            fillOpacity={0.92}
            stroke="none"
          />
          <Hairline
            d={`M ${P(-8, 232)} L ${P(-8, yTop - 14)} M ${P(8, 232)} L ${P(8, yTop - 14)}`}
            opacity={0.5}
            width={FINE}
            color={SHIRT_LINE}
          />
          {[244, 272, 300].map((y) => (
            <circle key={y} cx={CX} cy={y} r={1.9} fill={INK} fillOpacity={0.8} stroke="none" />
          ))}
        </>
      ) : (
        <path
          d={`M ${P(-9, 200)} L ${P(9, 200)} L ${P(12, 217)} L ${P(-12, 217)} Z M ${P(-10, 217)} C ${P(-14, 260)} ${P(-16, 300)} ${P(-16, 332)} L ${P(0, yTop + 10)} L ${P(16, 332)} C ${P(16, 300)} ${P(14, 260)} ${P(10, 217)} Z`}
          fill={INK}
          fillOpacity={0.92}
          stroke="none"
        />
      )}
    </>
  );
}

function JacketFront({ spec, cloth }: { spec: SuitSpec; cloth: ClothStyle }) {
  const stance = stanceOf(spec.jacket.buttons);
  const double = spec.jacket.breast === "double";
  const tuxedo = spec.garment === "tuxedo";
  const roped = spec.jacket.shoulder === "roped";
  const w = LAPEL_W[spec.jacket.lapelWidth];
  const { yTop, yLast } = stance;

  const shapes = Object.fromEntries(
    SIDES.map((s) => [s, lapelShapes(s, spec.jacket.lapel, w, yTop, double ? -s * DB_EDGE : 0)]),
  ) as Record<Side, LapelShapes>;

  /** The front edge on side `s` from the hem corner: the overlap of a double-breasted front, or the quarters opening below the last button. */
  const edge = (s: Side) =>
    double
      ? `L ${P(-s * (DB_EDGE - 6), HEM_Y)} Q ${P(-s * DB_EDGE, HEM_Y)} ${P(-s * DB_EDGE, HEM_Y - 6)} L ${P(-s * DB_EDGE, yTop)}`
      : `L ${P(s * QUARTER_DX, HEM_Y)} C ${P(s * 28, HEM_Y - 4)} ${P(0, yLast + 22)} ${P(0, yLast)} L ${P(0, yTop)}`;
  /** One front on side `s`: shoulder, side, hem, then the front edge up to the roll line and the neck. */
  const front = (s: Side) =>
    `M ${P(s * NECK_DX, NECK_Y)} ${shoulderOut(s)} ${sideDown(s)} ${edge(s)} ${shapes[s].roll} L ${P(s * 26, 200)} Z`;
  /** The hem and front edge lie on the trousers and the other front, so they take the cloth's ink. */
  const hemAndEdge = (s: Side) => `M ${P(s * HEM_DX, HEM_Y)} ${edge(s)}`;
  const dart = (s: Side) => `M ${P(s * 44, 434)} C ${P(s * 45, 384)} ${P(s * 49, 334)} ${P(s * 52, 300)}`;

  const sleeveButtons = spec.jacket.sleeveButtons === "five" ? 5 : 4;

  return (
    <>
      <Head view="front" />
      <ShirtFront spec={spec} yTop={yTop} />
      <Waistcoat spec={spec} cloth={cloth} />

      {/* the wearer's right front: on a double-breasted jacket it lies under the other */}
      <Piece d={front(-1)} cloth={cloth} />
      <Seam d={hemAndEdge(-1)} cloth={cloth} />
      <Seam d={dart(-1)} cloth={cloth} opacity={0.4} width={FINE} />
      <Pockets s={-1} spec={spec} cloth={cloth} tuxedo={tuxedo} />
      {double ? <Piece d={shapes[-1].lapel} cloth={cloth} satin={tuxedo} edge="cloth" /> : null}

      <Piece d={front(1)} cloth={cloth} />
      <Seam d={hemAndEdge(1)} cloth={cloth} />
      <Seam d={dart(1)} cloth={cloth} opacity={0.4} width={FINE} />
      <Pockets s={1} spec={spec} cloth={cloth} tuxedo={tuxedo} />
      <Piece d={`M ${P(48, 283)} L ${P(88, 276)} L ${P(88, 268)} L ${P(48, 275)} Z`} cloth={cloth} detail />

      {double ? null : <Piece d={shapes[-1].lapel} cloth={cloth} satin={tuxedo} edge="cloth" />}
      <Piece d={shapes[1].lapel} cloth={cloth} satin={tuxedo} edge="cloth" />
      {SIDES.map((s) =>
        shapes[s].collar ? <Piece key={s} d={shapes[s].collar} cloth={cloth} satin={tuxedo} detail /> : null,
      )}

      {stance.rows.map((y) =>
        stance.columns.map((dx) => <Button key={`${dx}-${y}`} dx={dx} y={y} cloth={cloth} satin={tuxedo} />),
      )}
      {stance.showRow
        ? SIDES.map((s) => (
            <Button
              key={s}
              dx={s * (stance.showRow?.dx ?? 0)}
              y={stance.showRow?.y ?? 0}
              cloth={cloth}
              satin={tuxedo}
            />
          ))
        : null}

      {SIDES.map((s) => (
        <g key={s}>
          <Hand s={s} view="front" />
          <Sleeve s={s} cloth={cloth} roped={roped} buttons={sleeveButtons} working={spec.jacket.workingCuffs} />
        </g>
      ))}
    </>
  );
}

/* ---------- jacket back ---------- */

function JacketBack({ spec, cloth }: { spec: SuitSpec; cloth: ClothStyle }) {
  const tuxedo = spec.garment === "tuxedo";
  const roped = spec.jacket.shoulder === "roped";
  const vents = spec.jacket.vents;
  const torso = `M ${P(NECK_DX, 206)} ${shoulderOut(1)} ${sideDown(1)} L ${P(-HEM_DX, HEM_Y)} ${sideUp(-1)} ${shoulderIn(-1, 206)} Q ${P(0, 214)} ${P(NECK_DX, 206)} Z`;
  const collar = `M ${P(-44, 216)} C ${P(-46, 198)} ${P(-24, 190)} ${P(0, 190)} C ${P(24, 190)} ${P(46, 198)} ${P(44, 216)} C ${P(30, 223)} ${P(-30, 223)} ${P(-44, 216)} Z`;
  const seamEnd = vents === "single" ? 436 : HEM_Y;
  const sleeveButtons = spec.jacket.sleeveButtons === "five" ? 5 : 4;
  return (
    <>
      <Head view="back" />
      <Piece d={torso} cloth={cloth} />
      <Seam d={`M ${P(-HEM_DX, HEM_Y)} L ${P(HEM_DX, HEM_Y)}`} cloth={cloth} />
      <Piece d={collar} cloth={cloth} satin={tuxedo} detail />
      <Seam d={`M ${P(0, 223)} L ${P(0, seamEnd)}`} cloth={cloth} opacity={0.7} width={FINE} />
      {SIDES.map((s) => (
        <Seam
          key={s}
          d={`M ${P(s * 68, 262)} C ${P(s * 64, 330)} ${P(s * 58, 372)} ${P(s * 60, 420)} C ${P(s * 62, 470)} ${P(s * 64, 500)} ${P(s * 64, HEM_Y)}`}
          cloth={cloth}
          opacity={0.45}
          width={FINE}
        />
      ))}
      {vents === "single" ? (
        <Seam
          d={`M ${P(-2, 436)} L ${P(4, 436)} M ${P(1, 436)} L ${P(1, HEM_Y)} M ${P(-2, 470)} L ${P(-3, HEM_Y)}`}
          cloth={cloth}
        />
      ) : null}
      {vents === "double"
        ? SIDES.map((s) => (
            <Seam
              key={s}
              d={`M ${P(s * 78, 444)} L ${P(s * 86, 444)} M ${P(s * 82, 444)} L ${P(s * 82, HEM_Y)} M ${P(s * 85, 480)} L ${P(s * 86, HEM_Y)}`}
              cloth={cloth}
            />
          ))
        : null}
      {SIDES.map((s) => (
        <g key={s}>
          <Hand s={s} view="back" />
          <Sleeve s={s} cloth={cloth} roped={roped} buttons={sleeveButtons} working={spec.jacket.workingCuffs} />
        </g>
      ))}
    </>
  );
}

/* ---------- description ---------- */

function describeFigure(spec: SuitSpec, hex: string | null, pattern: ClothPattern, view: SuitFigureView): string {
  const label = <T extends string>(options: readonly Option<T>[], code: T) =>
    (options.find((option) => option.code === code)?.label ?? code).toLowerCase();
  const j = spec.jacket;
  const t = spec.trousers;
  const garment = `${label(GARMENT_OPTIONS, spec.garment)}${spec.garment === "tuxedo" ? "" : " suit"}`;
  const jacket = [
    label(BREAST_OPTIONS, j.breast),
    label(BUTTON_STANCE_OPTIONS, j.buttons),
    `${label(LAPEL_WIDTH_OPTIONS, j.lapelWidth)} ${label(LAPEL_OPTIONS, j.lapel)}`,
    `${label(POCKET_OPTIONS, j.pockets)}${j.ticketPocket ? " with a ticket pocket" : ""}`,
    view === "back" ? label(VENT_OPTIONS, j.vents) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const waistcoat = spec.waistcoat ? `, a ${label(WAISTCOAT_STYLE_OPTIONS, spec.waistcoat.style)} waistcoat` : "";
  const trousers = `${label(TROUSER_FIT_OPTIONS, t.fit)} ${label(PLEAT_OPTIONS, t.pleats)} trousers with a ${label(HEM_OPTIONS, t.hem)}`;
  const cloth = hex ? `in a ${CLOTH_PATTERN_LABELS[pattern].toLowerCase()} cloth` : "no cloth chosen yet";
  return `Studio illustration, ${view} view: a ${garment}, ${jacket}${waistcoat}; ${trousers}; ${cloth}.`;
}

/* ---------- the figure ---------- */

export function SuitFigure({ spec, hex, pattern = "solid", view = "front", className, title }: SuitFigureProps) {
  const uid = `sf${specHash(spec).slice(0, 8)}${hex ? hex.replace("#", "").toLowerCase() : "none"}${view[0]}`;
  const patternId = clothPatternId(uid, pattern);
  const cloth: ClothStyle = {
    fill: hex ?? "var(--muted)",
    dashed: hex === null,
    patternUrl: hex && pattern !== "solid" ? `url(#${patternId})` : null,
    satin: hex ? satinTone(hex) : "currentColor",
    satinOpacity: hex ? 1 : 0.14,
    edge: hex ? tonalEdge(hex) : "currentColor",
  };
  const label = title ?? describeFigure(spec, hex, pattern, view);
  const tuxedo = spec.garment === "tuxedo";
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 600 1000"
      preserveAspectRatio="xMidYMid meet"
      className={cn("h-full w-auto max-w-full text-foreground", className)}
      fill="none"
      stroke="none"
    >
      <title>{label}</title>
      {hex && pattern !== "solid" ? (
        <defs>
          <ClothPatternDef id={patternId} pattern={pattern} ink={patternInk(hex)} />
        </defs>
      ) : null}
      <ellipse cx={CX} cy={961} rx={128} ry={5} fill="currentColor" fillOpacity={0.1} stroke="none" />
      <Shoes view={view} />
      {view === "front" ? <path d={SHIRT_D} fill={SHIRT} stroke="none" /> : null}
      <Trousers spec={spec} cloth={cloth} view={view} tuxedo={tuxedo} />
      {view === "front" ? <JacketFront spec={spec} cloth={cloth} /> : <JacketBack spec={spec} cloth={cloth} />}
    </svg>
  );
}
