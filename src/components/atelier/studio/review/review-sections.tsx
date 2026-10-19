"use client";

import type { DraftView } from "@convex/atelier/drafts";
import type { PreviewJobView } from "@convex/atelier/previews";
import type { ClothSummary } from "@convex/atelier/views";
import {
  FIT_PROFILE_STATUS_LABELS,
  FIT_ROUTE_LABELS,
  OCCASION_LABELS,
  PREVIEW_STATUS_LABELS,
  type StudioStep,
} from "@convex/shared/atelier/enums";
import { eventReadiness } from "@convex/shared/atelier/policy";
import type { DescribedLine } from "@convex/shared/atelier/spec";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { heldPreviewLabel } from "@/components/atelier/studio/preview/result-controls";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { groupLines } from "@/lib/atelier/export-design";

type Section = DescribedLine["section"];

/** Which step changes each part of the order book. */
const SECTION_STEP: Record<Section, StudioStep> = {
  Garment: "style",
  Cloth: "cloth",
  Jacket: "style",
  Trousers: "style",
  Waistcoat: "style",
  Details: "details",
};

/** A heading in the order book with the one action that changes that part of the design. */
function SectionHeading({
  title,
  step,
  onEdit,
}: {
  title: string;
  step: StudioStep;
  onEdit: ((step: StudioStep) => void) | null;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <OrderBookSection>{title}</OrderBookSection>
      {onEdit ? (
        <Button
          variant="ghost"
          className="-mb-1 h-11 rounded-none px-2 text-sm underline underline-offset-4"
          onClick={() => onEdit(step)}
        >
          Edit
          <span className="sr-only"> {title.toLowerCase()}</span>
        </Button>
      ) : null}
    </div>
  );
}

/** The cloth row carries the mill-book photograph and the honest shade note beside its name. */
function ClothValue({ cloth, value }: { cloth: ClothSummary | null; value: string }) {
  if (!cloth) return <>{value}</>;
  return (
    <span className="flex items-start gap-3">
      <ItemImage
        src={cloth.imageUrl}
        alt={`${cloth.name} mill-book photograph`}
        variant="photo"
        className="w-14 shrink-0 rounded-[2px]"
      />
      <span className="min-w-0 space-y-1">
        <span className="block font-display text-base leading-tight">{cloth.name}</span>
        {cloth.mill ? <span className="block text-xs text-muted-foreground">{cloth.mill}</span> : null}
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-[2px] border border-foreground/20"
            style={{ backgroundColor: cloth.hex }}
          />
          {cloth.shadeConfirmed ? "confirmed shade" : "representative shade"}
        </span>
      </span>
    </span>
  );
}

function clothNote(cloth: ClothSummary | null): { note: string; tone: "warning" | "default" } | null {
  if (!cloth) return null;
  if (cloth.status === "withdrawn") return { note: "No longer offered by the house.", tone: "warning" };
  if (!cloth.inStock)
    return { note: "Not in stock — your concierge will confirm whether it can be sourced.", tone: "warning" };
  return null;
}

/**
 * The whole design as a tailor's order book (S24): the occasion first, then every decision with its
 * production id, then the fit and the preview. One Edit per section goes to the step that changes it.
 */
export function ReviewOrderBook({
  draft,
  preview,
  now,
  onEdit,
}: {
  draft: DraftView;
  /** The preview job the design points at; undefined while loading, null when there is none. */
  preview: PreviewJobView | null | undefined;
  now: number;
  /** Null hides every Edit action (a design that has left the studio). */
  onEdit: ((step: StudioStep) => void) | null;
}) {
  const readiness = eventReadiness(draft.eventDate, now);
  const groups = groupLines(draft.lines);
  const clothState = clothNote(draft.cloth);
  const heldPreview = preview ? heldPreviewLabel(preview) : null;

  return (
    <OrderBook aria-label="Your design">
      <div className="py-1">
        <SectionHeading title="Occasion" step="occasion" onEdit={onEdit} />
        <OrderBookRow
          label="Occasion"
          value={draft.occasion ? OCCASION_LABELS[draft.occasion] : "Not chosen"}
          tone={draft.occasion ? "default" : "muted"}
        />
        <OrderBookRow
          label="Event date"
          value={draft.eventDate !== undefined ? formatDate(draft.eventDate) : "No date given"}
          tone={draft.eventDate !== undefined ? (readiness.state === "comfortable" ? "default" : "warning") : "muted"}
          note={readiness.state !== "none" ? readiness.copy : undefined}
        />
        {draft.intendedUse ? <OrderBookRow label="Intended use" value={draft.intendedUse} /> : null}
      </div>

      {groups.map((group) => (
        <div key={group.section} className="py-1">
          <SectionHeading title={group.section} step={SECTION_STEP[group.section]} onEdit={onEdit} />
          {group.lines.map((line) => {
            if (group.section === "Cloth") {
              return (
                <OrderBookRow
                  key={line.label}
                  label={line.label}
                  value={<ClothValue cloth={draft.cloth} value={line.value} />}
                  code={line.productionId}
                  tone={clothState?.tone ?? (draft.cloth ? "default" : "muted")}
                  note={clothState?.note}
                />
              );
            }
            return <OrderBookRow key={line.label} label={line.label} value={line.value} code={line.productionId} />;
          })}
        </div>
      ))}

      <div className="py-1">
        <SectionHeading title="Fit" step="fit" onEdit={onEdit} />
        <OrderBookRow
          label="Route"
          value={draft.fitRoute ? FIT_ROUTE_LABELS[draft.fitRoute] : "Not chosen yet"}
          tone={draft.fitRoute ? "default" : "muted"}
          note={
            draft.fitRoute
              ? "A preference for your concierge, not an appointment."
              : "Choose how the house measures you: at a showroom or at home with the guide."
          }
        />
        <OrderBookRow
          label="Fit profile"
          value={
            draft.fitProfile
              ? `Version ${draft.fitProfile.version} · ${FIT_PROFILE_STATUS_LABELS[draft.fitProfile.status]}`
              : "None attached"
          }
          tone={draft.fitProfile ? "default" : "muted"}
          note={
            draft.fitProfile
              ? undefined
              : "Measurements come from a fitting or an approved profile on your account; a preview never measures you."
          }
        />
      </div>

      <div className="py-1">
        <SectionHeading title="Preview" step="preview" onEdit={onEdit} />
        {preview === undefined && draft.currentPreview ? (
          <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto]">
            <Skeleton className="h-3.5 w-24 rounded-sm" />
            <Skeleton className="h-3.5 w-56 rounded-sm" />
          </div>
        ) : preview ? (
          <OrderBookRow
            label="Personal preview"
            value={`${heldPreview ?? PREVIEW_STATUS_LABELS[preview.status]} · ${preview.isCurrent ? "current design" : "previous design"}`}
            tone={preview.isCurrent && heldPreview === null ? "default" : "warning"}
            note={
              <>
                {heldPreview !== null ? <span>Its image is not shown · </span> : null}
                <span>{preview.specLabel}</span>
                {preview.revision !== null ? <span> · Revision {preview.revision}</span> : null}
                <span> · Illustrative preview — not a fitting</span>
              </>
            }
          />
        ) : (
          <OrderBookRow
            label="Personal preview"
            value="None"
            tone="muted"
            note="The studio illustration shows every choice; a photograph is optional."
          />
        )}
      </div>
    </OrderBook>
  );
}
