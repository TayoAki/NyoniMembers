"use client";

import { CalendarCheck, Shapes, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { draftFromOutfit, EMPTY_DRAFT, OutfitForm } from "@/components/outfits/outfit-form";
import { OutfitBuilderSkeleton } from "@/components/outfits/outfits-skeleton";
import { RenderPanel } from "@/components/renders/render-panel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOutfitActions, useOutfits, useOutfit, type Outfit } from "@/hooks/use-outfits";
import { formatRelative, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Id } from "@convex/_generated/dataModel";

type OutfitBuilderProps = { mode: "create" } | { mode: "edit"; outfitId: Id<"outfits"> };

/** The /outfits/new and /outfits/[outfitId] screen. One board, two modes. */
export function OutfitBuilder(props: OutfitBuilderProps) {
  if (props.mode === "create") return <CreateBuilder />;
  return <EditBuilder outfitId={props.outfitId} />;
}

function CreateBuilder() {
  const outfits = useOutfits();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outfit"
        title="New outfit"
        description="Tap a slot to pick from your wardrobe. Save it, then see it on yourself."
        actions={
          <Button variant="outline" render={<Link href={routes.outfits} />}>
            Cancel
          </Button>
        }
      />
      <OutfitForm mode="create" initial={EMPTY_DRAFT} outfitCount={outfits?.length ?? 0} />
    </div>
  );
}

function EditBuilder({ outfitId }: { outfitId: Id<"outfits"> }) {
  const outfit = useOutfit(outfitId);
  const outfits = useOutfits();

  if (outfit === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outfit" description="Loading…" />
        <OutfitBuilderSkeleton />
      </div>
    );
  }

  if (outfit === null) {
    return (
      <EmptyState
        icon={Shapes}
        title="This outfit is gone"
        description="It may have been deleted, or the link is wrong."
        action={<Button render={<Link href={routes.outfits} />}>Back to outfits</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={outfit.source === "agent" ? "Stylist outfit" : "Outfit"}
        title={outfit.name}
        description={describe(outfit)}
        actions={<OutfitActionsRow outfit={outfit} />}
      />
      <OutfitForm
        key={outfit._id}
        mode="edit"
        outfitId={outfit._id}
        initial={draftFromOutfit(outfit)}
        outfitCount={outfits?.length ?? 0}
      />
      <RenderPanel outfit={outfit} />
    </div>
  );
}

function OutfitActionsRow({ outfit }: { outfit: Outfit }) {
  const actions = useOutfitActions();
  const router = useRouter();
  const [wearPending, setWearPending] = useState(false);

  async function handleWorn() {
    setWearPending(true);
    const result = await actions.markWorn(outfit._id);
    setWearPending(false);
    if (result !== undefined) toast.success("Logged as worn today.");
  }

  return (
    <>
      <Button variant="outline" onClick={() => void handleWorn()} disabled={wearPending}>
        {wearPending ? <Spinner data-icon="inline-start" /> : <CalendarCheck data-icon="inline-start" />}
        Worn today
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" aria-label="Delete this outfit">
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        }
        title="Delete this outfit?"
        description="The outfit and every render made from it are removed. Your clothes stay in the wardrobe."
        confirmLabel="Delete outfit"
        destructive
        onConfirm={async () => {
          const result = await actions.remove(outfit._id);
          if (result === undefined) return;
          toast.success("Outfit deleted.");
          router.push(routes.outfits);
        }}
      />
    </>
  );
}

function describe(outfit: Outfit): string {
  const worn =
    outfit.wornOn.length > 0
      ? `${pluralize(outfit.wornOn.length, "wear")} · last worn ${formatRelative(Math.max(...outfit.wornOn))}`
      : "Never worn";
  return [outfit.occasion, worn].filter(Boolean).join(" · ");
}
