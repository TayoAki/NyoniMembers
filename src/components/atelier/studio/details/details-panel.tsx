"use client";

import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { CommitError } from "@/components/atelier/studio/style/commit-error";
import { LockedNote } from "@/components/atelier/studio/style/locked-note";
import { SavingIndicator } from "@/components/atelier/studio/style/saving-indicator";
import { usePanelCommit } from "@/components/atelier/studio/style/use-panel-commit";
import { ButtonPicker } from "./button-picker";
import { LiningPicker } from "./lining-picker";
import { MonogramForm } from "./monogram-form";

/**
 * S09: buttons, lining and the monogram. Each choice commits on its own through the editor; the panel
 * shows what is saving and keeps the choice on screen when the server could not take it.
 */
export function DetailsPanel() {
  const { draft } = useStudio();
  const { pending, failure, run, retry } = usePanelCommit();
  const locked = draft.status !== "draft";
  const busy = pending !== null || locked;

  return (
    <div>
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
        The buttons, the lining and, if you like, your initials. Each choice is saved as you make it and carries the
        supplier&apos;s reference into your order book.
      </p>

      <LockedNote status={draft.status} what="buttons, lining and monogram" className="mb-6" />

      <AtelierSection
        id="details-buttons"
        level={2}
        title="Buttons"
        description="Horn, corozo and shell from the house's standard range."
        actions={pending === "buttons" ? <SavingIndicator /> : undefined}
      >
        <ButtonPicker
          titleId="details-buttons-title"
          disabled={busy}
          onCommit={(patch) => void run("buttons", patch)}
        />
        {failure?.tag === "buttons" ? <CommitError className="mt-4" failure={failure} onRetry={retry} /> : null}
      </AtelierSection>

      <AtelierSection
        id="details-lining"
        level={2}
        title="Lining"
        description="The interior of the jacket, and of the waistcoat when it has a lining back."
        actions={pending === "lining" ? <SavingIndicator /> : undefined}
      >
        <LiningPicker titleId="details-lining-title" disabled={busy} onCommit={(patch) => void run("lining", patch)} />
        {failure?.tag === "lining" ? <CommitError className="mt-4" failure={failure} onRetry={retry} /> : null}
      </AtelierSection>

      <AtelierSection
        id="details-monogram"
        level={2}
        title="Monogram"
        description="Up to four letters, embroidered inside the jacket."
        actions={pending === "monogram" ? <SavingIndicator /> : undefined}
        className="pb-0"
      >
        <MonogramForm
          titleId="details-monogram-title"
          disabled={busy}
          onCommit={(patch) => void run("monogram", patch)}
        />
        {failure?.tag === "monogram" ? <CommitError className="mt-4" failure={failure} onRetry={retry} /> : null}
      </AtelierSection>
    </div>
  );
}
