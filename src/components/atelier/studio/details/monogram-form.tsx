"use client";

import { useId, useState } from "react";
import { MONOGRAM_RULES, normalizeMonogramText } from "@convex/shared/atelier/materials";
import {
  MONOGRAM_FONT_OPTIONS,
  MONOGRAM_PLACEMENT_OPTIONS,
  MONOGRAM_THREAD_OPTIONS,
  validateSpec,
  type Monogram,
  type MonogramFont,
  type MonogramPlacement,
  type MonogramThread,
  type Option,
  type SpecPatch,
} from "@convex/shared/atelier/spec";
import { Mono } from "@/components/atelier/common/mono";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { optionCode, optionLabel } from "@/components/atelier/studio/style/detail-groups";
import { OptionList, OptionRow } from "@/components/atelier/studio/style/option-list";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const DEFAULT_MONOGRAM: Omit<Monogram, "text"> = { placement: "inside_pocket", thread: "gold", font: "script" };

function monogramKey(monogram: Monogram | null): string {
  return monogram ? `${monogram.text}|${monogram.placement}|${monogram.thread}|${monogram.font}` : "none";
}

/**
 * S09, the monogram. Letters are validated as they are typed against the engine's own rules; the
 * letters commit when the field is left, placement, thread and lettering commit on choice once letters
 * exist. The closed jacket cannot show the interior, so the form says where it goes instead of drawing it.
 */
export function MonogramForm(props: { titleId: string; disabled: boolean; onCommit: (patch: SpecPatch) => void }) {
  const { editor } = useStudio();
  // Re-seed the local fields from the committed monogram whenever the server's copy changes.
  return <MonogramFields key={monogramKey(editor.spec.monogram)} {...props} />;
}

function MonogramFields({
  titleId,
  disabled,
  onCommit,
}: {
  titleId: string;
  disabled: boolean;
  onCommit: (patch: SpecPatch) => void;
}) {
  const { editor } = useStudio();
  const committed = editor.spec.monogram;
  const inputId = useId();
  const [text, setText] = useState(committed?.text ?? "");
  const [placement, setPlacement] = useState<MonogramPlacement>(committed?.placement ?? DEFAULT_MONOGRAM.placement);
  const [thread, setThread] = useState<MonogramThread>(committed?.thread ?? DEFAULT_MONOGRAM.thread);
  const [font, setFont] = useState<MonogramFont>(committed?.font ?? DEFAULT_MONOGRAM.font);
  const [touched, setTouched] = useState(false);

  const monogramErrors = (candidate: Monogram | null) =>
    validateSpec(editor.preview({ monogram: candidate }).spec).filter((message) => /monogram/i.test(message));

  const candidate: Monogram | null = text.length > 0 || committed ? { text, placement, thread, font } : null;
  const errors = monogramErrors(candidate);
  const valid = candidate !== null && errors.length === 0;
  // Letters are checked as they are typed; the "enter the letters" message waits until the field is left.
  const showErrors = errors.length > 0 && (text.length > 0 || touched);

  function commitIfValid(next: Monogram) {
    if (next.text.length === 0 || monogramErrors(next).length > 0) return;
    if (monogramKey(next) === monogramKey(committed)) return;
    onCommit({ monogram: next });
  }

  function choose<T extends string>(
    options: readonly Option<T>[],
    value: string,
    set: (value: T) => void,
    build: (value: T) => Monogram,
  ) {
    const option = options.find((entry) => entry.code === value);
    if (!option) return;
    set(option.code);
    commitIfValid(build(option.code));
  }

  return (
    <div className="space-y-6">
      <Field data-invalid={showErrors ? "true" : undefined}>
        <FieldLabel htmlFor={inputId}>Letters</FieldLabel>
        <Input
          id={inputId}
          value={text}
          disabled={disabled}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="N.S."
          className="h-11 max-w-[12rem] rounded-none font-display text-xl tracking-[0.08em]"
          aria-invalid={showErrors || undefined}
          aria-describedby={`${inputId}-help`}
          onChange={(event) => setText(normalizeMonogramText(event.target.value))}
          onBlur={() => {
            setTouched(true);
            if (valid && candidate) commitIfValid(candidate);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid && candidate) {
              event.preventDefault();
              commitIfValid(candidate);
            }
          }}
        />
        <FieldDescription id={`${inputId}-help`}>{MONOGRAM_RULES.help}</FieldDescription>
        {showErrors ? <FieldError>{errors[0]}</FieldError> : null}
      </Field>

      <ChoiceGroup
        legend="Placement"
        idPrefix="monogram-placement"
        options={MONOGRAM_PLACEMENT_OPTIONS}
        value={placement}
        committedValue={committed?.placement ?? null}
        disabled={disabled}
        onChoose={(value) =>
          choose(MONOGRAM_PLACEMENT_OPTIONS, value, setPlacement, (code) => ({ text, placement: code, thread, font }))
        }
      />
      <ChoiceGroup
        legend="Thread"
        idPrefix="monogram-thread"
        options={MONOGRAM_THREAD_OPTIONS}
        value={thread}
        committedValue={committed?.thread ?? null}
        disabled={disabled}
        onChoose={(value) =>
          choose(MONOGRAM_THREAD_OPTIONS, value, setThread, (code) => ({ text, placement, thread: code, font }))
        }
      />
      <ChoiceGroup
        legend="Lettering"
        idPrefix="monogram-font"
        options={MONOGRAM_FONT_OPTIONS}
        value={font}
        committedValue={committed?.font ?? null}
        disabled={disabled}
        onChoose={(value) =>
          choose(MONOGRAM_FONT_OPTIONS, value, setFont, (code) => ({ text, placement, thread, font: code }))
        }
      />

      <div className="space-y-2 border-t border-foreground/15 pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          The studio illustration shows the closed jacket, so the interior is not drawn. {MONOGRAM_RULES.placementNote}
        </p>
        <p>
          {committed ? (
            <>
              In your design: <span className="font-display text-sm text-foreground">{committed.text}</span>
              {" · "}
              {optionLabel(MONOGRAM_PLACEMENT_OPTIONS, committed.placement)} ·{" "}
              {optionLabel(MONOGRAM_THREAD_OPTIONS, committed.thread)} ·{" "}
              {optionLabel(MONOGRAM_FONT_OPTIONS, committed.font)}{" "}
              <Mono>
                {optionCode(MONOGRAM_PLACEMENT_OPTIONS, committed.placement)}+
                {optionCode(MONOGRAM_THREAD_OPTIONS, committed.thread)}+
                {optionCode(MONOGRAM_FONT_OPTIONS, committed.font)}
              </Mono>
            </>
          ) : text.length > 0 && errors.length > 0 ? (
            "Not in your design yet: the letters above need attention first."
          ) : text.length > 0 ? (
            "Not in your design yet: leave the letters field, or press Enter, to add the monogram."
          ) : (
            <>
              No monogram. <Mono>MONO_NONE</Mono>
            </>
          )}
        </p>
      </div>

      {committed || text.length > 0 ? (
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          disabled={disabled}
          aria-describedby={titleId}
          onClick={() => {
            setText("");
            setTouched(false);
            if (committed) onCommit({ monogram: null });
          }}
        >
          {committed ? "Remove monogram" : "Clear letters"}
        </Button>
      ) : null}
    </div>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  idPrefix,
  options,
  value,
  committedValue,
  disabled,
  onChoose,
}: {
  legend: string;
  idPrefix: string;
  options: readonly Option<T>[];
  value: T;
  committedValue: T | null;
  disabled: boolean;
  onChoose: (value: string) => void;
}) {
  const legendId = `${idPrefix}-legend`;
  return (
    <div>
      <p id={legendId} className="text-sm font-medium">
        {legend}
      </p>
      <OptionList
        aria-labelledby={legendId}
        value={value}
        disabled={disabled}
        onValueChange={onChoose}
        className="mt-2"
      >
        {options.map((option) => (
          <OptionRow
            key={option.code}
            id={`${idPrefix}-${option.code}`}
            value={option.code}
            title={option.label}
            description={option.description}
            code={option.productionId}
            current={committedValue === option.code}
          />
        ))}
      </OptionList>
    </div>
  );
}
