"use client";

import { X } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

type ChipsInputProps = {
  value: readonly string[];
  onValueChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  maxChips?: number;
  /** Colour names get a swatch dot; the browser resolves whatever CSS understands. */
  swatches?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

function normalise(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Free-text tags in a single box: Enter or comma commits, Backspace on an empty box removes the last.
 * Used for "colours to avoid" in onboarding and secondary colours on an item.
 */
export function ChipsInput({
  value,
  onValueChange,
  placeholder = "Type and press Enter",
  id,
  disabled = false,
  maxChips = 12,
  swatches = false,
  className,
  ...aria
}: ChipsInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const atLimit = value.length >= maxChips;

  function commit(raw: string) {
    const next = normalise(raw);
    setDraft("");
    if (!next || atLimit || value.includes(next)) return;
    onValueChange([...value, next]);
  }

  function remove(chip: string) {
    onValueChange(value.filter((entry) => entry !== chip));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      remove(value[value.length - 1]);
    }
  }

  return (
    <div
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1.5 text-sm transition-colors focus-within:ring-3",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((chip) => (
        <span
          key={chip}
          className="bg-secondary text-secondary-foreground inline-flex h-6 items-center gap-1.5 rounded-full pr-1 pl-2 text-xs font-medium"
        >
          {swatches ? (
            <span
              className="ring-foreground/15 size-2.5 shrink-0 rounded-full ring-1"
              style={{ backgroundColor: chip }}
              aria-hidden
            />
          ) : null}
          {chip}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              remove(chip);
            }}
            disabled={disabled}
            className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:ring-ring flex size-4 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Remove ${chip}`}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={inputId}
        value={draft}
        disabled={disabled || atLimit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={atLimit ? `Up to ${maxChips}` : value.length ? "" : placeholder}
        aria-describedby={aria["aria-describedby"]}
        className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent text-base outline-none md:text-sm"
      />
    </div>
  );
}
