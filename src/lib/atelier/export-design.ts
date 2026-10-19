import type { DraftExport } from "@convex/atelier/drafts";
import type { DescribedLine, SuitSpec } from "@convex/shared/atelier/spec";

/**
 * The downloadable and printable record of a design (C12, C19): the same order-book lines the review,
 * the receipt and the staff view read, stamped with the moment the client took the copy. It is a studio
 * record of a design, never an order or a quote: no price, no date and no availability is written in.
 */

export type ExportFacts = {
  draftId: string;
  occasion?: string | null;
  /** Already formatted for reading, e.g. "14 Jun 2027". */
  eventDate?: string | null;
  fitRoute?: string | null;
};

export type ExportedDesign = {
  source: "Nyoni Atelier";
  kind: "design-record";
  draftId: string;
  name: string;
  revision: number;
  specHash: string;
  /** ISO 8601, stamped by the client when it downloads or prints. */
  exportedAt: string;
  occasion: string | null;
  eventDate: string | null;
  fitRoute: string | null;
  spec: SuitSpec;
  lines: DescribedLine[];
  note: string;
};

export const EXPORT_NOTE =
  "A record of a design made in the Nyoni Atelier. It is not an order, a quote or a booking: prices, dates and availability are confirmed by the house in writing.";

export function stampExport(record: DraftExport, facts: ExportFacts, now: number = Date.now()): ExportedDesign {
  return {
    source: "Nyoni Atelier",
    kind: "design-record",
    draftId: facts.draftId,
    name: record.name,
    revision: record.revision,
    specHash: record.specHash,
    exportedAt: new Date(now).toISOString(),
    occasion: facts.occasion ?? null,
    eventDate: facts.eventDate ?? null,
    fitRoute: facts.fitRoute ?? null,
    spec: record.spec,
    lines: record.lines,
    note: EXPORT_NOTE,
  };
}

export function designFilename(name: string, revision: number): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "design";
  return `nyoni-atelier-${slug}-r${revision}.json`;
}

export type LineGroup = { section: DescribedLine["section"]; lines: DescribedLine[] };

/** Lines grouped by their section in the order `describeSpec` emits them. */
export function groupLines(lines: readonly DescribedLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.section === line.section) last.lines.push(line);
    else groups.push({ section: line.section, lines: [line] });
  }
  return groups;
}

/** Hands the browser a JSON file; nothing leaves the browser. */
export function downloadDesignJson(design: ExportedDesign): void {
  const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = designFilename(design.name, design.revision);
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A self-contained print page: ink on white, the order book as a ruled table, the record's facts. */
export function printDocumentHtml(design: ExportedDesign): string {
  const facts: [string, string][] = [
    ["Revision", String(design.revision)],
    ["Record", design.specHash],
    ["Exported", new Date(design.exportedAt).toLocaleString("en-US")],
  ];
  if (design.occasion) facts.push(["Occasion", design.occasion]);
  if (design.eventDate) facts.push(["Event date", design.eventDate]);
  if (design.fitRoute) facts.push(["Fit", design.fitRoute]);

  const sections = groupLines(design.lines)
    .map(
      (group) => `
      <tbody>
        <tr class="section"><th colspan="3">${escapeHtml(group.section)}</th></tr>
        ${group.lines
          .map(
            (line) => `
        <tr>
          <th scope="row">${escapeHtml(line.label)}</th>
          <td>${escapeHtml(line.value)}</td>
          <td class="code">${line.productionId ? escapeHtml(line.productionId) : ""}</td>
        </tr>`,
          )
          .join("")}
      </tbody>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(design.name)} · Nyoni Atelier</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #000; background: #fff; font: 11pt/1.45 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #000; padding-bottom: 8pt; }
  .house { font: 500 9pt/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.16em; text-transform: uppercase; }
  h1 { margin: 14pt 0 4pt; font: 500 24pt/1.1 "Bodoni Moda", "Bodoni 72", Didot, Georgia, "Times New Roman", serif; letter-spacing: -0.01em; }
  dl.facts { display: grid; grid-template-columns: max-content 1fr; gap: 2pt 14pt; margin: 0 0 14pt; font-size: 9.5pt; }
  dl.facts dt { color: #444; }
  dl.facts dd { margin: 0; font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  tr.section th { padding: 10pt 0 3pt; text-align: left; font: 500 8pt/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #444; border: 0; }
  tbody tr:not(.section) th, tbody tr:not(.section) td { padding: 4pt 0; border-top: 1px solid #ccc; vertical-align: top; }
  th[scope="row"] { width: 28%; text-align: left; font-weight: 500; color: #444; }
  td.code { width: 22%; text-align: right; font: 8pt/1.6 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: #444; }
  footer { margin-top: 16pt; font-size: 9pt; color: #444; }
</style>
</head>
<body>
  <header>
    <span class="house">Nyoni Couture · Atelier</span>
    <span class="house">Design record</span>
  </header>
  <h1>${escapeHtml(design.name)}</h1>
  <dl class="facts">
    ${facts.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}
  </dl>
  <table>${sections}</table>
  <footer>${escapeHtml(design.note)}</footer>
</body>
</html>`;
}

const PRINT_FRAME_TIMEOUT_MS = 120_000;

/**
 * Prints the record from a hidden frame so the studio around it is untouched and nothing is opened in a
 * new tab. Resolves false when the browser gave no frame to print from.
 */
export function printDesign(design: ExportedDesign): boolean {
  if (typeof document === "undefined") return false;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.visibility = "hidden";

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    frame.remove();
  };

  frame.addEventListener("load", () => {
    const target = frame.contentWindow;
    if (!target) {
      remove();
      return;
    }
    target.addEventListener("afterprint", remove);
    try {
      target.focus();
      target.print();
    } catch {
      remove();
    }
    window.setTimeout(remove, PRINT_FRAME_TIMEOUT_MS);
  });

  frame.srcdoc = printDocumentHtml(design);
  document.body.append(frame);
  return true;
}
