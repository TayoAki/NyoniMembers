"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type WordOption<T extends string> = { code: T; label: string; description?: string; disabled?: boolean };

/**
 * A compact select over a closed list of coded options, typed by the option codes. The trigger shows the
 * label, never the code; the code goes to the backend. Used for every spec field in the proposal
 * composer and for the catalogue's enumerated fields.
 */
export function WordSelect<T extends string>({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: T | null;
  onValueChange: (value: T) => void;
  options: readonly WordOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const items = Object.fromEntries(options.map((option) => [option.code, option.label]));
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.code === next);
        if (option && !option.disabled) onValueChange(option.code);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.code} value={option.code} disabled={option.disabled}>
            <span className="flex flex-col gap-0.5 whitespace-normal">
              <span>{option.label}</span>
              {option.description ? <span className="text-xs text-muted-foreground">{option.description}</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
