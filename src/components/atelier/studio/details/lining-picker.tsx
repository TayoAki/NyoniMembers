"use client";

import { LINING_SEED } from "@convex/shared/atelier/materials";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { MaterialPicker } from "./material-picker";

/** The linings the house offers on this base style; the choice commits through the editor. */
export function LiningPicker({
  titleId,
  disabled,
  onCommit,
}: {
  titleId: string;
  disabled: boolean;
  onCommit: (patch: { liningCode: string | null }) => void;
}) {
  const { catalogue, editor } = useStudio();
  return (
    <MaterialPicker
      kind="lining"
      titleId={titleId}
      entries={catalogue?.linings}
      seeds={LINING_SEED}
      garment={editor.spec.garment}
      committedCode={editor.spec.liningCode}
      disabled={disabled}
      onChoose={(code) => onCommit({ liningCode: code })}
    />
  );
}
