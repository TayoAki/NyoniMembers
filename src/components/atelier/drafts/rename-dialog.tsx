"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const NAME_MAX = 80;

type RenameDialogProps = {
  draftId: Id<"atelierDrafts">;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Renames a design. The input survives a failed save; Cancel discards the edit. */
export function RenameDialog({ draftId, name, open, onOpenChange }: RenameDialogProps) {
  const rename = useMutation(api.atelier.drafts.rename);
  const guestKeyArg = useGuestKeyArg();
  const { draftIndex, rememberDraft } = useAtelierSession();
  const inputId = useId();
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const trimmed = value.trim();
  const tooLong = trimmed.length > NAME_MAX;
  const invalid = trimmed.length === 0 || tooLong;

  function close(next: boolean) {
    if (pending) return;
    if (!next) {
      setValue(name);
      setMessage(null);
    }
    onOpenChange(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid) {
      setMessage(trimmed.length === 0 ? "Give the design a name." : `A name is at most ${NAME_MAX} characters.`);
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      await rename({ ...guestKeyArg, draftId, name: trimmed });
      if (draftIndex.some((entry) => entry.draftId === draftId))
        rememberDraft({ draftId, name: trimmed, updatedAt: Date.now() });
      onOpenChange(false);
    } catch (error) {
      setMessage(reportError(error, "Could not rename the design.").message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-sm">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Rename this design</DialogTitle>
            <DialogDescription>
              The name is for you and your concierge; it is not part of the specification.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={message ? true : undefined}>
            <FieldLabel htmlFor={inputId}>Name</FieldLabel>
            <Input
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setMessage(null);
              }}
              maxLength={NAME_MAX + 20}
              autoFocus
              aria-invalid={message ? true : undefined}
              className="h-11 rounded-none"
            />
            {message ? <FieldError>{message}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-none"
              onClick={() => close(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-none" disabled={pending || invalid}>
              {pending ? <Spinner data-icon="inline-start" aria-label="Saving the name" /> : null}
              {pending ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
