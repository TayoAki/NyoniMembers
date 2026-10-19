"use client";

import { ArrowRight } from "lucide-react";
import type { Conflict } from "@convex/shared/atelier/spec";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConflictDialogProps = {
  /** The conflicts awaiting a decision; null keeps the dialog closed. */
  conflicts: Conflict[] | null;
  /** True applies the change with every listed detail; false keeps the design exactly as it was. */
  onDecide: (accept: boolean) => void;
};

/**
 * S08. The dependency engine had to move other details to keep the suit makeable. The client applies
 * them all or keeps the design; closing the dialog any other way is "keep my design" (cross-cutting
 * scenario 2: nothing is written until they choose).
 */
export function ConflictDialog({ conflicts, onDecide }: ConflictDialogProps) {
  const open = conflicts !== null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecide(false);
      }}
    >
      <DialogContent showCloseButton={false} className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">This change moves other details</DialogTitle>
          <DialogDescription>
            To keep the suit makeable, these details would change with it. Apply them all, or keep your design as it is.
          </DialogDescription>
        </DialogHeader>
        {conflicts && conflicts.length > 0 ? (
          <OrderBook aria-label="Details that would change">
            {conflicts.map((conflict) => (
              <OrderBookRow
                key={conflict.field}
                label={conflict.label}
                value={
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground">{conflict.from}</span>
                    <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                    <span className="sr-only">becomes</span>
                    <span>{conflict.to}</span>
                  </span>
                }
                note={conflict.reason}
              />
            ))}
          </OrderBook>
        ) : null}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={() => onDecide(false)}>
            Keep my design
          </Button>
          <Button className="min-h-11" onClick={() => onDecide(true)}>
            Apply all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
