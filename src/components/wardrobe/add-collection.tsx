"use client";

import { useAction, useConvexAuth } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { api } from "@convex/_generated/api";

/** Adds (or restores) the house capsule in the member's wardrobe. Free, idempotent, additive. */
export function AddCollection({ onSeeded }: { onSeeded: () => void }) {
  const seed = useAction(api.collection.seed);
  const { isAuthenticated } = useConvexAuth();
  const [pending, setPending] = useState(false);

  async function handleSeed() {
    setPending(true);
    try {
      const { added, removed, skipped } = await seed({});
      onSeeded();
      const awaiting = skipped > 0 ? ` ${pluralize(skipped, "piece")} still awaiting photos.` : "";
      const retired = removed > 0 ? ` ${pluralize(removed, "piece")} retired from the capsule.` : "";
      if (added === 0 && removed === 0) {
        toast.success(`The Nyoni capsule is already in your wardrobe.${awaiting}`);
      } else if (added === 0) {
        toast.success(`Your wardrobe is up to date.${retired}${awaiting}`);
      } else {
        toast.success(`${pluralize(added, "Nyoni piece")} added to your wardrobe.${retired}${awaiting}`);
      }
    } catch (error) {
      reportError(error, "Could not add the capsule. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      className="h-10 rounded-full px-4"
      disabled={!isAuthenticated || pending}
      onClick={() => void handleSeed()}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
      {pending ? "Adding the capsule…" : "Add the Nyoni capsule"}
    </Button>
  );
}
