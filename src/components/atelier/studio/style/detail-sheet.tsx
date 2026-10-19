"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { CommitError } from "./commit-error";
import { DETAIL_PART_LABELS, optionLabel, type DetailGroup } from "./detail-groups";
import { OptionList, OptionRow } from "./option-list";
import type { CommitFailure } from "./use-panel-commit";

/**
 * S07, the focused detail. The option list shows the committed value marked; picking another shows it
 * on the stage without saving; Apply commits (the core asks about any conflicts first); Cancel or closing
 * puts the stage back. After "Keep my design" the sheet stays open with the committed value selected.
 */
export function DetailSheet({
  group,
  open,
  instance,
  onOpenChange,
}: {
  group: DetailGroup | null;
  open: boolean;
  /** Changes each time the sheet opens, so the list starts again from the committed value. */
  instance: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { editor } = useStudio();
  const close = () => {
    editor.stage(null);
    onOpenChange(false);
  };
  return (
    <Sheet
      open={open && group !== null}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {group ? <DetailSheetBody key={`${group.key}:${instance}`} group={group} onClose={close} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailSheetBody({ group, onClose }: { group: DetailGroup; onClose: () => void }) {
  const { editor } = useStudio();
  const committed = editor.spec;
  const committedCode = group.current(committed);
  const [selected, setSelected] = useState(committedCode);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<CommitFailure | null>(null);

  // Whatever closes this sheet, the stage goes back to the committed design.
  const stageRef = useRef(editor.stage);
  useEffect(() => {
    stageRef.current = editor.stage;
  }, [editor.stage]);
  useEffect(() => () => stageRef.current(null), []);

  const allowed = group.allowed(committed);
  const options = allowed ? group.options.filter((option) => allowed.includes(option.code)) : group.options;
  const hidden = group.options.length - options.length;
  const limitNote = hidden > 0 ? group.limitNote(committed) : null;

  const changed = selected !== committedCode;
  const alsoChanges = changed ? editor.preview(group.patch(selected)).conflicts : [];

  function select(value: string) {
    setFailure(null);
    setSelected(value);
    editor.stage(value === committedCode ? null : group.patch(value));
  }

  async function apply() {
    if (!changed) {
      onClose();
      return;
    }
    const patch = group.patch(selected);
    setPending(true);
    setFailure(null);
    try {
      const outcome = await editor.commit(patch);
      if (outcome.status === "committed") {
        onClose();
      } else if (outcome.status === "cancelled") {
        setSelected(committedCode);
        editor.stage(null);
      } else {
        setFailure({ tag: group.key, code: outcome.code, message: outcome.message, patch });
      }
    } finally {
      setPending(false);
    }
  }

  const titleId = `detail-${group.key}-title`;

  return (
    <>
      <SheetHeader className="border-b border-foreground/15 px-5 py-5">
        <SheetTitle id={titleId} className="text-2xl font-medium tracking-tight">
          {group.label}
        </SheetTitle>
        <SheetDescription className="text-pretty">
          {DETAIL_PART_LABELS[group.part]} · {group.why}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <OptionList aria-labelledby={titleId} value={selected} disabled={pending} onValueChange={select}>
          {options.map((option) => (
            <OptionRow
              key={option.code}
              id={`detail-${group.key}-${option.code}`}
              value={option.code}
              title={option.label}
              description={option.description}
              code={option.productionId}
              current={option.code === committedCode}
            />
          ))}
        </OptionList>

        {limitNote ? (
          <p className="mt-3 text-xs leading-relaxed text-pretty text-muted-foreground">
            {hidden === 1
              ? "One option is not offered on this design. "
              : `${hidden} options are not offered on this design. `}
            {limitNote}
          </p>
        ) : null}

        {alsoChanges.length > 0 ? (
          <div className="mt-4 border-t border-foreground/15 pt-3">
            <p className="text-xs font-medium">Also changes</p>
            <ul className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {alsoChanges.map((conflict) => (
                <li key={conflict.field}>
                  <span className="text-foreground">{conflict.label}</span>: {conflict.from} → {conflict.to}.{" "}
                  {conflict.reason}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              You will be asked to confirm before anything is saved.
            </p>
          </div>
        ) : null}

        {failure ? (
          <CommitError
            className="mt-4"
            failure={failure}
            onRetry={() => {
              void apply();
            }}
          />
        ) : null}
      </div>

      <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-foreground/15 px-5 py-4">
        <Button variant="outline" className="h-11 rounded-none px-5" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button className="h-11 rounded-none px-5" onClick={() => void apply()} disabled={pending || !changed}>
          {pending ? <Spinner data-icon="inline-start" aria-hidden /> : null}
          {pending ? "Saving…" : changed ? `Apply ${optionLabel(group.options, selected).toLowerCase()}` : "Apply"}
        </Button>
      </SheetFooter>
    </>
  );
}
