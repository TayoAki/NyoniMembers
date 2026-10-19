import type { Infer } from "convex/values";
import { QUOTE_LINE_KIND_LABELS, type QuoteLineKind } from "./enums";
import type { vQuoteLine } from "./validators";

/**
 * Quote-line arithmetic and validation, shared by the quotes model and the staff composer so the total a
 * concierge sees while writing a quote is the total the house records.
 */

export type QuoteLine = Infer<typeof vQuoteLine>;

/** Lines that make up the garment itself; delivery, tax, benefit and adjustments sit below the subtotal. */
export const SUBTOTAL_KINDS: readonly QuoteLineKind[] = ["commission", "cloth", "option"];
/** Lines that take money off; every other kind adds. */
export const CREDIT_KINDS: readonly QuoteLineKind[] = ["benefit", "discount"];

export const QUOTE_LINES_MAX = 40;
export const QUOTE_LINE_TEXT_MAX = 120;

export function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Subtotal is the garment; total is every line. Both rounded to the cent. */
export function computeTotals(lines: readonly QuoteLine[]): { subtotalUsd: number; totalUsd: number } {
  const subtotalUsd = roundUsd(
    lines.filter((line) => SUBTOTAL_KINDS.includes(line.kind)).reduce((sum, line) => sum + line.amountUsd, 0),
  );
  const totalUsd = roundUsd(lines.reduce((sum, line) => sum + line.amountUsd, 0));
  return { subtotalUsd, totalUsd };
}

/** Field errors that stop a quote being saved; an empty array means the lines can be priced. */
export function validateLines(lines: readonly QuoteLine[]): string[] {
  const errors: string[] = [];
  if (lines.length === 0) errors.push("A quote needs at least one line.");
  if (lines.length > QUOTE_LINES_MAX) errors.push(`A quote has at most ${QUOTE_LINES_MAX} lines.`);
  lines.forEach((line, index) => {
    const where = `Line ${index + 1}`;
    if (!line.code.trim()) errors.push(`${where} needs a code.`);
    if (!line.label.trim()) errors.push(`${where} needs a label.`);
    if (line.label.length > QUOTE_LINE_TEXT_MAX || line.code.length > QUOTE_LINE_TEXT_MAX)
      errors.push(`${where} is too long.`);
    if (!Number.isFinite(line.amountUsd)) errors.push(`${where} needs an amount.`);
    else if (CREDIT_KINDS.includes(line.kind) && line.amountUsd > 0)
      errors.push(
        `${where}: a ${QUOTE_LINE_KIND_LABELS[line.kind].toLowerCase()} takes money off, so its amount is zero or negative.`,
      );
    else if (!CREDIT_KINDS.includes(line.kind) && line.amountUsd < 0)
      errors.push(`${where}: a ${QUOTE_LINE_KIND_LABELS[line.kind].toLowerCase()} cannot be negative.`);
  });
  if (errors.length === 0 && computeTotals(lines).totalUsd < 0) errors.push("The total cannot be below zero.");
  return errors;
}
