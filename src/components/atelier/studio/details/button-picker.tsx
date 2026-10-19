"use client";

import { BUTTON_SEED } from "@convex/shared/atelier/materials";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { MaterialPicker } from "./material-picker";

/** The buttons the house offers on this base style; the choice commits through the editor. */
export function ButtonPicker({
  titleId,
  disabled,
  onCommit,
}: {
  titleId: string;
  disabled: boolean;
  onCommit: (patch: { buttonCode: string | null }) => void;
}) {
  const { catalogue, editor } = useStudio();
  return (
    <MaterialPicker
      kind="button"
      titleId={titleId}
      entries={catalogue?.buttons}
      seeds={BUTTON_SEED}
      garment={editor.spec.garment}
      committedCode={editor.spec.buttonCode}
      disabled={disabled}
      onChoose={(code) => onCommit({ buttonCode: code })}
    />
  );
}
