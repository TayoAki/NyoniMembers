"use client";

import { Fragment, useState } from "react";
import type { Garment } from "@convex/shared/atelier/spec";
import { OrderBook, OrderBookSection } from "@/components/atelier/common/order-book";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { BaseStyle } from "./base-style";
import { CommitError } from "./commit-error";
import { DETAIL_PART_LABELS, detailRowsFor, findGroup, type DetailPart } from "./detail-groups";
import { DetailRow, DetailToggleRow } from "./detail-row";
import { DetailSheet } from "./detail-sheet";
import { SavingIndicator } from "./saving-indicator";
import { usePanelCommit } from "./use-panel-commit";

const PARTS: readonly DetailPart[] = ["jacket", "trousers", "waistcoat"];

type SheetState = { key: string | null; open: boolean; instance: number };

/**
 * S06: the base style, then the jacket, trouser and (on a three-piece) waistcoat details as an order
 * book. Switch rows commit on the spot; every other row opens the focused detail sheet (S07). The rows
 * always show the committed design, never a preview that was abandoned.
 */
export function StylePanel() {
  const { editor } = useStudio();
  const spec = editor.spec;
  const { pending, failure, run, retry } = usePanelCommit();
  const [sheet, setSheet] = useState<SheetState>({ key: null, open: false, instance: 0 });
  const busy = pending !== null;

  const parts = PARTS.filter((part) => part !== "waistcoat" || spec.waistcoat !== null);

  return (
    <div className="space-y-8">
      <section aria-labelledby="style-base-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="style-base-title" className="text-xl font-medium tracking-tight sm:text-2xl">
            Base style
          </h2>
          {pending === "garment" ? <SavingIndicator /> : null}
        </div>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          Three silhouettes the house cuts. Changing one never resets the details you have chosen; where a style needs a
          detail moved, you are asked first.
        </p>
        <div className="mt-5">
          <BaseStyle spec={spec} disabled={busy} onChoose={(garment: Garment) => void run("garment", { garment })} />
        </div>
        {failure?.tag === "garment" ? <CommitError className="mt-4" failure={failure} onRetry={retry} /> : null}
      </section>

      <section aria-labelledby="style-details-title" className="border-t border-foreground/15 pt-6">
        <h2 id="style-details-title" className="text-xl font-medium tracking-tight sm:text-2xl">
          Tailoring details
        </h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          One decision per row, with its production code. Change a detail to see it on the figure before you apply it.
        </p>
        <OrderBook className="mt-5">
          {parts.map((part) => (
            <Fragment key={part}>
              <OrderBookSection>{DETAIL_PART_LABELS[part]}</OrderBookSection>
              {detailRowsFor(part).map((row) =>
                row.kind === "choice" ? (
                  <DetailRow
                    key={row.group.key}
                    group={row.group}
                    spec={spec}
                    saving={pending === row.group.key}
                    disabled={busy}
                    onChange={() =>
                      setSheet((prev) => ({ key: row.group.key, open: true, instance: prev.instance + 1 }))
                    }
                  />
                ) : (
                  <DetailToggleRow
                    key={row.toggle.key}
                    toggle={row.toggle}
                    spec={spec}
                    saving={pending === row.toggle.key}
                    disabled={busy}
                    onToggle={(value) => void run(row.toggle.key, row.toggle.patch(value))}
                  />
                ),
              )}
            </Fragment>
          ))}
        </OrderBook>
        {failure && failure.tag !== "garment" ? (
          <CommitError className="mt-4" failure={failure} onRetry={retry} />
        ) : null}
      </section>

      <DetailSheet
        group={sheet.key ? findGroup(sheet.key) : null}
        open={sheet.open}
        instance={sheet.instance}
        onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
      />
    </div>
  );
}
