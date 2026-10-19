"use client";

import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import type { LocalDraftEntry } from "@/lib/atelier/local-drafts";

type LocalOnlyRowProps = {
  entry: LocalDraftEntry;
  /** Whether the viewer is signed in: an account draft is out of reach, not gone, when they are not. */
  signedIn: boolean;
  onForget: () => void;
};

/**
 * A draft this browser remembers that the server did not return. The words say why as far as this
 * browser can tell: a draft it saw saved to an account is still saved, only not reachable signed out;
 * anything else may have been archived from another device, or saved to a different account.
 */
export function LocalOnlyRow({ entry, signedIn, onForget }: LocalOnlyRowProps) {
  const savedToAccount = entry.account === true;
  const outOfReach = savedToAccount && !signedIn;
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-1.5">
        <p className="text-base font-medium text-muted-foreground">{entry.name}</p>
        {outOfReach ? (
          <StatusLine tone="neutral">Saved to an account — sign in to open it</StatusLine>
        ) : (
          <StatusLine tone="warning">
            {savedToAccount ? "Not among this account's drafts" : "No longer on the server"}
          </StatusLine>
        )}
        <p className="text-xs text-muted-foreground">
          Remembered by this browser · last saved {formatRelative(entry.updatedAt).toLowerCase()}.{" "}
          {outOfReach
            ? "It was saved to an account from this browser; nothing has been lost."
            : savedToAccount
              ? "It may have been archived from another device, or saved to a different account."
              : "It may have been archived from another device."}
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
