import type { Occasion } from "./enums";
import { DEFAULT_SPEC, DEFAULT_WAISTCOAT, type JacketSpec, type SuitSpec, type TrouserSpec } from "./spec";

/**
 * Recommended looks (S01, C02): a small, explained selection per occasion. Each is a complete spec in a
 * real cloth from `cloths.ts`, named the way the house names its suits (a proper name after the
 * descriptive title). Applying one populates the draft; nothing is hidden behind it.
 */
export type Look = {
  key: string;
  name: string;
  properName: string;
  occasions: readonly Occasion[];
  why: string;
  spec: SuitSpec;
};

type LookInput = Omit<Partial<SuitSpec>, "jacket" | "trousers"> & { jacket?: Partial<JacketSpec>; trousers?: Partial<TrouserSpec> };

function look(spec: LookInput): SuitSpec {
  return {
    ...DEFAULT_SPEC,
    ...spec,
    jacket: { ...DEFAULT_SPEC.jacket, ...(spec.jacket ?? {}) },
    trousers: { ...DEFAULT_SPEC.trousers, ...(spec.trousers ?? {}) },
    waistcoat: spec.waistcoat === undefined ? DEFAULT_SPEC.waistcoat : spec.waistcoat,
  };
}

export const LOOKS: readonly Look[] = [
  {
    key: "armada",
    name: "Navy Two-Piece, Peak Lapel",
    properName: "Armada",
    occasions: ["wedding", "business"],
    why: "A peak lapel on a single-breasted navy suit reads formal enough for a ceremony and settles into a boardroom the week after.",
    spec: look({
      garment: "two_piece",
      clothCode: "taveller-4-seasons",
      jacket: { lapel: "peak", vents: "double", pockets: "flap", buttons: "two" },
      trousers: { fit: "tailored", pleats: "flat", hem: "plain", waistband: "side_adjusters" },
      buttonCode: "btn-horn-dark",
      liningCode: "lin-bemberg-bordeaux",
    }),
  },
  {
    key: "euforia",
    name: "Black Shawl-Collar Tuxedo",
    properName: "Euforia",
    occasions: ["black_tie"],
    why: "One button, a shawl lapel and jetted pockets: the dinner jacket as it has always been cut, in a true black Super 140's.",
    spec: look({
      garment: "tuxedo",
      clothCode: "jorgecarli-a1-super-140s",
      jacket: { breast: "single", buttons: "one", lapel: "shawl", lapelWidth: "standard", vents: "none", pockets: "jetted", ticketPocket: false, canvas: "full" },
      trousers: { fit: "tailored", pleats: "single", rise: "high", hem: "plain", waistband: "side_adjusters" },
      buttonCode: "btn-satin-covered",
      liningCode: "lin-paisley-black",
    }),
  },
  {
    key: "leonardo",
    name: "Charcoal Business Two-Piece",
    properName: "Leonardo",
    occasions: ["business", "corporate"],
    why: "Charcoal Loro Piana 365 with a notch lapel and flat-front trousers: the suit that works five days a week and travels well.",
    spec: look({
      garment: "two_piece",
      clothCode: "loro-piana-365-s-130s-wool",
      jacket: { lapel: "notch", vents: "double", pockets: "flap", buttons: "two", ticketPocket: false },
      trousers: { fit: "tailored", pleats: "flat", hem: "plain", waistband: "belt_loops" },
      buttonCode: "btn-horn-smoke",
      liningCode: "lin-bemberg-navy",
    }),
  },
  {
    key: "dominico",
    name: "Midnight Double-Breasted Three-Piece",
    properName: "Dominico",
    occasions: ["wedding", "black_tie"],
    why: "Six buttons, two to close, over a double-breasted waistcoat: the fullest construction statement the house makes, in a fifteen-micron Zegna.",
    spec: look({
      garment: "three_piece",
      clothCode: "i-preziosi-15-milmil-15-zegna-247",
      jacket: { breast: "double", buttons: "six_by_two", lapel: "peak", lapelWidth: "wide", vents: "double", pockets: "jetted", canvas: "full", shoulder: "roped" },
      trousers: { fit: "classic", pleats: "single", rise: "high", hem: "cuffed", waistband: "side_adjusters" },
      waistcoat: { ...DEFAULT_WAISTCOAT, style: "double", lapel: "shawl", back: "cloth" },
      buttonCode: "btn-horn-dark",
      liningCode: "lin-bemberg-gold",
    }),
  },
  {
    key: "fonda-azul",
    name: "Natural Linen Summer Two-Piece",
    properName: "Fonda Azul",
    occasions: ["wedding", "casual_refinement"],
    why: "Irish linen, patch pockets and a half canvas: tailoring for a garden wedding or a long summer.",
    spec: look({
      garment: "two_piece",
      clothCode: "nyoni-odm001-irish-linen",
      jacket: { lapel: "notch", lapelWidth: "slim", vents: "double", pockets: "patch", buttons: "two", canvas: "half", shoulder: "natural" },
      trousers: { fit: "tailored", pleats: "single", rise: "mid", hem: "cuffed", waistband: "side_adjusters" },
      buttonCode: "btn-mop",
      liningCode: "lin-bemberg-ivory",
    }),
  },
  {
    key: "giorgio",
    name: "Grey Glen Check Three-Piece",
    properName: "Giorgio",
    occasions: ["business", "casual_refinement"],
    why: "A Biella glen check with a cloth-backed waistcoat you can wear on its own; the pattern carries the suit, so the details stay quiet.",
    spec: look({
      garment: "three_piece",
      clothCode: "guabello-biella-1815-d-o-b-g",
      jacket: { lapel: "notch", vents: "double", pockets: "flap", ticketPocket: true, buttons: "two" },
      trousers: { fit: "tailored", pleats: "flat", rise: "mid", hem: "cuffed", waistband: "side_adjusters" },
      waistcoat: { style: "single_six", lapel: "none", back: "cloth" },
      buttonCode: "btn-horn-smoke",
      liningCode: "lin-bemberg-forest",
    }),
  },
  {
    key: "kirton",
    name: "Brown Flannel Weekend Two-Piece",
    properName: "Kirton",
    occasions: ["casual_refinement", "corporate"],
    why: "A warm brown flannel with patch pockets and a single pleat: relaxed in the cloth, exact in the cut.",
    spec: look({
      garment: "two_piece",
      clothCode: "kamino-zenith-501-flannel",
      jacket: { lapel: "notch", vents: "single", pockets: "patch", buttons: "three", canvas: "half" },
      trousers: { fit: "classic", pleats: "single", rise: "mid", hem: "cuffed", waistband: "belt_loops" },
      buttonCode: "btn-horn-light",
      liningCode: "lin-tonal",
    }),
  },
];

export function lookByKey(key: string): Look | undefined {
  return LOOKS.find((look) => look.key === key);
}

export function looksForOccasion(occasion: Occasion | undefined): readonly Look[] {
  if (!occasion) return LOOKS;
  const matching = LOOKS.filter((look) => look.occasions.includes(occasion));
  return matching.length > 0 ? matching : LOOKS;
}
