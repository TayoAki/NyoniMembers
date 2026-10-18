import type { ClothPattern } from "@convex/shared/atelier/enums";
import type { SuitSpec } from "@convex/shared/atelier/spec";
import { cn } from "@/lib/utils";

export type SuitFigureProps = {
  spec: SuitSpec;
  /** The cloth's representative shade; null draws the "no cloth chosen" state. */
  hex: string | null;
  pattern?: ClothPattern;
  view?: "front" | "back";
  className?: string;
  title?: string;
};

/**
 * PLACEHOLDER studio illustration: a simplified hairline figure so the studio composes and compiles.
 * The studio figure agent replaces this file with the parametric drawing; props stay as declared here.
 */
export function SuitFigure({ spec, hex, pattern = "solid", view = "front", className, title }: SuitFigureProps) {
  const fill = hex ?? "var(--muted)";
  const double = spec.jacket.breast === "double";
  const label =
    title ??
    `Studio illustration of a ${spec.garment.replace("_", "-")} with a ${spec.jacket.lapel} lapel${hex ? "" : ", no cloth chosen yet"}`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 600 1000"
      className={cn("h-full w-auto max-w-full text-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinejoin="round"
    >
      <title>{label}</title>
      {pattern !== "solid" ? (
        <defs>
          <pattern id="sf-stripe" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 0V14" stroke="currentColor" strokeOpacity="0.18" />
          </pattern>
        </defs>
      ) : null}
      <circle cx="300" cy="110" r="44" strokeOpacity="0.7" />
      <path d="M280 156 h40 v26 h-40z" strokeOpacity="0.5" />
      {/* jacket */}
      <path
        d="M196 196 L300 180 L404 196 L430 420 L410 560 L190 560 L170 420 Z"
        fill={fill}
        strokeDasharray={hex ? undefined : "6 6"}
      />
      {pattern !== "solid" ? <path d="M196 196 L300 180 L404 196 L430 420 L410 560 L190 560 L170 420 Z" fill="url(#sf-stripe)" /> : null}
      {view === "front" ? (
        <>
          <path d={double ? "M300 182 L262 300 L286 560" : "M300 182 L300 560"} strokeOpacity="0.8" />
          <path d="M300 182 L246 330 M300 182 L354 330" strokeOpacity="0.8" />
          {[0, 1].map((i) => (
            <circle key={i} cx={double ? 278 : 300} cy={372 + i * 48} r="5" fill="currentColor" fillOpacity="0.6" stroke="none" />
          ))}
        </>
      ) : (
        <path d={spec.jacket.vents === "double" ? "M236 470 V560 M364 470 V560" : spec.jacket.vents === "single" ? "M300 470 V560" : ""} strokeOpacity="0.8" />
      )}
      {/* sleeves */}
      <path d="M196 196 L130 470 L178 480 L212 300 Z" fill={fill} strokeDasharray={hex ? undefined : "6 6"} />
      <path d="M404 196 L470 470 L422 480 L388 300 Z" fill={fill} strokeDasharray={hex ? undefined : "6 6"} />
      {/* trousers */}
      <path d="M198 560 H402 L392 940 H318 L300 700 L282 940 H208 Z" fill={fill} strokeDasharray={hex ? undefined : "6 6"} />
      <path d="M208 940 h74 v22 h-82z M318 940 h74 v22 h-82z" fill="currentColor" fillOpacity="0.85" stroke="none" />
    </svg>
  );
}
