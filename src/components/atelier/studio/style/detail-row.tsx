"use client";

import { useId } from "react";
import type { SuitSpec } from "@convex/shared/atelier/spec";
import { OrderBookRow } from "@/components/atelier/common/order-book";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DETAIL_PART_LABELS,
  optionCode,
  optionLabel,
  toggleCode,
  type DetailGroup,
  type DetailToggle,
} from "./detail-groups";
import { SavingIndicator } from "./saving-indicator";

/** On phones the label takes the first line and the decision shares the second with its action. */
const PHONE_ROW =
  "grid-cols-[minmax(0,1fr)_auto] items-center [&>dt]:col-span-2 sm:[&>dt]:col-span-1 sm:items-baseline";

/** One tailoring decision as an order-book row: label, the committed value, its production id, Change. */
export function DetailRow({
  group,
  spec,
  saving,
  disabled,
  onChange,
}: {
  group: DetailGroup;
  spec: SuitSpec;
  /** True while this row's own change is reaching the server. */
  saving: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  const code = group.current(spec);
  return (
    <OrderBookRow
      className={PHONE_ROW}
      label={group.label}
      value={optionLabel(group.options, code)}
      code={optionCode(group.options, code)}
      note={saving ? <SavingIndicator /> : undefined}
      action={
        <Button
          variant="ghost"
          className="h-11 rounded-none px-3 sm:h-9"
          aria-label={`Change ${DETAIL_PART_LABELS[group.part].toLowerCase()} ${group.label.toLowerCase()}`}
          disabled={disabled}
          onClick={onChange}
        >
          Change
        </Button>
      }
    />
  );
}

/** A yes/no detail with a switch in the action column; the row says why it is off when it cannot be on. */
export function DetailToggleRow({
  toggle,
  spec,
  saving,
  disabled,
  onToggle,
}: {
  toggle: DetailToggle;
  spec: SuitSpec;
  saving: boolean;
  disabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  const id = useId();
  const value = toggle.get(spec);
  const reason = toggle.disabledReason(spec);
  const locked = reason !== null && !value;
  return (
    <OrderBookRow
      className={PHONE_ROW}
      label={<label htmlFor={id}>{toggle.label}</label>}
      value={value ? "Yes" : "No"}
      code={toggleCode(spec, toggle)}
      tone={locked ? "muted" : "default"}
      note={saving ? <SavingIndicator /> : locked ? reason : undefined}
      action={
        <span className="inline-flex min-h-11 items-center sm:min-h-9">
          <Switch
            id={id}
            checked={value}
            disabled={disabled || locked}
            onCheckedChange={(next) => onToggle(next)}
            aria-describedby={locked ? `${id}-reason` : undefined}
          />
          {locked ? (
            <span id={`${id}-reason`} className="sr-only">
              {reason}
            </span>
          ) : null}
        </span>
      }
    />
  );
}
