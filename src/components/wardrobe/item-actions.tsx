"use client";

import { useMutation } from "convex/react";
import { CalendarCheck, Eye, EyeOff, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CreditQuote } from "@/components/common/credit-quote";
import { JobStepper } from "@/components/common/job-stepper";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useJob } from "@/hooks/use-active-jobs";
import { useCreditQuote } from "@/hooks/use-credits";
import type { Item } from "@/hooks/use-items";
import { reportError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CREDIT_COSTS } from "@convex/shared/credits";

/** Everything you can do to an item that is not editing its attributes. */
export function ItemActions({ item }: { item: Item }) {
  const router = useRouter();
  const markWorn = useMutation(api.items.markWorn);
  const setStatus = useMutation(api.items.setStatus);
  const reextract = useMutation(api.items.reextract);
  const removeItems = useMutation(api.items.remove);

  const [pending, setPending] = useState<"worn" | "status" | null>(null);
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  const job = useJob(jobId);
  const quote = useCreditQuote({ kind: "extract", items: CREDIT_COSTS.extractItem });
  const hidden = item.status === "hidden";

  async function run(kind: "worn" | "status", action: () => Promise<unknown>, success: string) {
    setPending(kind);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      reportError(error);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void run("worn", () => markWorn({ itemId: item._id }), "Marked as worn today.")}
          disabled={pending !== null}
        >
          {pending === "worn" ? <Spinner data-icon="inline-start" /> : <CalendarCheck data-icon="inline-start" />}
          Worn today
        </Button>

        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <Wand2 data-icon="inline-start" />
              Re-extract
            </Button>
          }
          title="Cut this item out again?"
          description="Runs the extraction on the original photo again and replaces the cutout. The old one is discarded."
          confirmLabel="Re-extract"
          onConfirm={async () => {
            const result = await reextract({ itemId: item._id });
            setJobId(result.jobId);
            toast.success("Re-extraction started.");
          }}
        >
          <CreditQuote quote={quote} label="one cutout" />
        </ConfirmDialog>

        <Button
          variant="outline"
          onClick={() =>
            void run(
              "status",
              () => setStatus({ itemIds: [item._id], status: hidden ? "ready" : "hidden" }),
              hidden ? "Back in your wardrobe." : "Hidden from the grid.",
            )
          }
          disabled={pending !== null}
        >
          {pending === "status" ? (
            <Spinner data-icon="inline-start" />
          ) : hidden ? (
            <Eye data-icon="inline-start" />
          ) : (
            <EyeOff data-icon="inline-start" />
          )}
          {hidden ? "Unhide" : "Hide"}
        </Button>

        <ConfirmDialog
          trigger={
            <Button variant="destructive">
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          }
          title={`Delete ${item.name}?`}
          description="The cutout is deleted and the item is removed from any outfits that use it. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await removeItems({ itemIds: [item._id] });
            toast.success("Item deleted.");
            router.push(routes.wardrobe);
          }}
        />
      </div>

      {job ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Re-extraction</p>
          <JobStepper job={job} />
        </div>
      ) : null}
    </div>
  );
}
