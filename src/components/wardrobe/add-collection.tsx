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

/** Adds (or restores) the house collection to the member's wardrobe. Free, idempotent, additive. */
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
      if (added === 0 && removed === 0) {
        toast.success(`The Nyoni collection is already in your wardrobe.${awaiting}`);
      } else {
        toast.success(`${pluralize(added, "Nyoni piece")} added to your wardrobe.${awaiting}`);
      }
    } catch (error) {
      reportError(error, "Could not add the collection. Try again.");
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
      {pending ? "Adding the collection…" : "Add the Nyoni collection"}
    </Button>
  );
}
