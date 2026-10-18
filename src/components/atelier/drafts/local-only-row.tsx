"use client";

import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import type { LocalDraftEntry } from "@/lib/atelier/local-drafts";

/** A draft this browser remembers that the server no longer returns (archived elsewhere, or gone). */
export function LocalOnlyRow({ entry, onForget }: { entry: LocalDraftEntry; onForget: () => void }) {
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-1.5">
        <p className="text-base font-medium text-muted-foreground">{entry.name}</p>
        <StatusLine tone="warning">No longer on the server</StatusLine>
        <p className="text-xs text-muted-foreground">
          Remembered by this browser · last saved {formatRelative(entry.updatedAt).toLowerCase()}. It may have been
          archived from another device.
        </p>
      </div>
      <div>
        <Button variant="ghost" className="h-11 rounded-none px-3" onClick={onForget}>
          Forget
        </Button>
      </div>
    </li>
  );
}
