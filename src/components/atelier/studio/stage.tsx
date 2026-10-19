"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { PreviewJobView } from "@convex/atelier/previews";
import type { CatalogueEntryView, ClothSummary } from "@convex/atelier/views";
import { CLOTH_PATTERN_LABELS, CLOTH_WEIGHT_LABELS } from "@convex/shared/atelier/enums";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findCatalogueEntry } from "@/hooks/atelier/use-catalogue";
import { cn } from "@/lib/utils";
import { useStudio, type StageMode, type StageView } from "./panel-contract";
import { useStudioCore } from "./studio-provider";
import { SuitFigure } from "./suit-figure";

const MODES: readonly StageMode[] = ["studio", "swatch", "personal"];
const VIEWS: readonly StageView[] = ["front", "back"];
const MODE_LABELS: Record<StageMode, string> = { studio: "Studio", swatch: "Swatch", personal: "Personal" };
const VIEW_LABELS: Record<StageView, string> = { front: "Front", back: "Back" };
const CROSSFADE = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

const TOGGLE_ITEM = "h-11 min-w-11 px-3 text-[13px]";

function isMode(value: unknown): value is StageMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}
function isView(value: unknown): value is StageView {
  return typeof value === "string" && (VIEWS as readonly string[]).includes(value);
}

/**
 * The signature move (DESIGN.md → The Atelier): the studio illustration wearing the shown design in
 * the cloth's representative shade, or the personal preview, or the cloth itself. Captions tell the
 * truth about what each one is; the one authored motion is the crossfade when the cloth changes.
 */
export function Stage({ className }: { className?: string }) {
  const { draft, editor, catalogue, stage, goToStep } = useStudio();
  const { currentPreview } = useStudioCore();
  const shown = editor.shown;
  const entry = findCatalogueEntry(catalogue?.cloths, shown.clothCode);
  const cloth: ClothSummary | null =
    entry ?? (draft.cloth && draft.cloth.code === shown.clothCode ? draft.cloth : null);

  return (
    <figure className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="relative min-h-0 flex-1">
        {stage.mode === "studio" ? (
          <FigureLayer cloth={cloth} />
        ) : stage.mode === "swatch" ? (
          <SwatchView cloth={cloth} entry={entry} onChooseCloth={() => goToStep("cloth")} />
        ) : (
          <PersonalView job={currentPreview} onGoToPreview={() => goToStep("preview")} />
        )}
      </div>
      <figcaption className="mt-3 flex min-h-5 flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {stage.mode === "personal" ? (
          <>
            <span className="font-medium text-foreground">Illustrative preview — not a fitting</span>
            {currentPreview?.specLabel ? <span>{currentPreview.specLabel}</span> : null}
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">
              {stage.mode === "swatch" ? "Mill book photograph" : "Studio illustration"}
            </span>
            {cloth ? (
              <>
                <span className="font-display text-sm text-foreground">{cloth.name}</span>
                {!cloth.shadeConfirmed ? <span>representative shade</span> : null}
              </>
            ) : (
              <span>No cloth chosen yet</span>
            )}
          </>
        )}
      </figcaption>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          aria-label="What the stage shows"
          variant="outline"
          spacing={0}
          value={[stage.mode]}
          onValueChange={(values) => {
            const next = values[0];
            if (isMode(next)) stage.setMode(next);
          }}
        >
          {MODES.map((mode) => (
            <ToggleGroupItem key={mode} value={mode} className={TOGGLE_ITEM}>
              {MODE_LABELS[mode]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {stage.mode === "studio" ? (
          <ToggleGroup
            aria-label="Side of the figure"
            variant="outline"
            spacing={0}
            value={[stage.view]}
            onValueChange={(values) => {
              const next = values[0];
              if (isView(next)) stage.setView(next);
            }}
          >
            {VIEWS.map((view) => (
              <ToggleGroupItem key={view} value={view} className={TOGGLE_ITEM}>
                {VIEW_LABELS[view]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </div>
    </figure>
  );
}

/** The figure, crossfading only when the cloth's shade or pattern changes; cut changes redraw in place. */
function FigureLayer({ cloth }: { cloth: ClothSummary | null }) {
  const { editor, stage } = useStudio();
  const reduceMotion = useReducedMotion();
  const hex = cloth?.hex ?? null;
  const pattern = cloth?.pattern ?? "solid";
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`${hex ?? "none"}|${pattern}`}
        className="absolute inset-0 flex items-center justify-center"
        initial={reduceMotion ? false : { opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)" }}
        transition={reduceMotion ? { duration: 0 } : CROSSFADE}
      >
        <div className="aspect-[3/5] h-full max-w-full">
          <SuitFigure spec={editor.shown} hex={hex} pattern={pattern} view={stage.view} className="size-full" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function SwatchView({
  cloth,
  entry,
  onChooseCloth,
}: {
  cloth: ClothSummary | null;
  entry: CatalogueEntryView | null;
  onChooseCloth: () => void;
}) {
  if (!cloth) {
    return (
      <StageNote
        title="No cloth chosen yet"
        body="The swatch view shows the mill's book photograph of the cloth you choose."
      >
        <Button variant="outline" className="min-h-11" onClick={onChooseCloth}>
          Choose a cloth
        </Button>
      </StageNote>
    );
  }
  const imageUrl = entry?.imageUrl ?? cloth.imageUrl;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 sm:flex-row sm:items-stretch">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {imageUrl ? (
          <ItemImage
            src={imageUrl}
            alt={`Mill book photograph of ${cloth.name}`}
            variant="photo"
            aspect="aspect-[4/5]"
            className="h-full w-auto max-w-full rounded-none"
          />
        ) : (
          <div className="flex aspect-[4/5] h-full max-w-full items-center justify-center border border-foreground/15 text-xs text-muted-foreground">
            No photograph for this cloth yet
          </div>
        )}
      </div>
      <dl className="shrink-0 space-y-2 text-sm sm:w-56 sm:self-center">
        <div>
          <dt className="sr-only">Cloth</dt>
          <dd className="font-display text-lg leading-tight">{cloth.name}</dd>
        </div>
        {cloth.mill ? (
          <div>
            <dt className="text-xs text-muted-foreground">Mill</dt>
            <dd>{cloth.mill}</dd>
          </div>
        ) : null}
        {entry?.composition ? (
          <div>
            <dt className="text-xs text-muted-foreground">Composition</dt>
            <dd>{entry.composition}</dd>
          </div>
        ) : null}
        {entry?.weight ? (
          <div>
            <dt className="text-xs text-muted-foreground">Weight</dt>
            <dd>{CLOTH_WEIGHT_LABELS[entry.weight]}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-muted-foreground">Shade</dt>
          <dd className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-4 border border-foreground/20"
              style={{ backgroundColor: cloth.hex }}
            />
            <span>{CLOTH_PATTERN_LABELS[cloth.pattern]}</span>
            <span className="text-xs text-muted-foreground">
              {cloth.shadeConfirmed ? "shade confirmed" : "representative shade"}
            </span>
          </dd>
        </div>
        {entry?.supplierRef ? (
          <div>
            <dt className="sr-only">Supplier reference</dt>
            <dd>
              <Mono>{entry.supplierRef}</Mono>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function PersonalView({ job, onGoToPreview }: { job: PreviewJobView | null; onGoToPreview: () => void }) {
  if (!job) {
    return (
      <StageNote
        title="No personal preview yet"
        body="Add a photograph on the “See it on you” step to see this design illustrated on you."
      >
        <Button variant="outline" className="min-h-11" onClick={onGoToPreview}>
          See it on you
        </Button>
      </StageNote>
    );
  }
  if (job.status === "done" && job.resultUrl) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {!job.isCurrent ? (
          <StatusLine tone="warning" className="mb-2 shrink-0">
            Shows a previous design
          </StatusLine>
        ) : null}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ItemImage
            src={job.resultUrl}
            alt={`Illustrative preview of ${job.specLabel}`}
            variant="render"
            className="h-full w-auto max-w-full rounded-none"
            priority
          />
        </div>
      </div>
    );
  }
  const working = job.status === "queued" || job.status === "processing";
  return (
    <StageNote
      title={
        <StatusLine live tone={working ? "gold" : job.status === "failed" ? "destructive" : "neutral"}>
          {job.statusLabel}
        </StatusLine>
      }
      body={
        working
          ? "Usually a minute or two. You can keep designing; the studio illustration shows every choice meanwhile."
          : job.status === "failed"
            ? (job.error ?? "The preview could not be finished. The studio illustration still shows every choice.")
            : "The studio illustration still shows every choice."
      }
    >
      <Button variant="outline" className="min-h-11" onClick={onGoToPreview}>
        Open “See it on you”
      </Button>
    </StageNote>
  );
}

function StageNote({ title, body, children }: { title: ReactNode; body: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-3 border-y border-foreground/15 py-6 sm:px-2">
      {typeof title === "string" ? <p className="text-sm font-medium">{title}</p> : title}
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
