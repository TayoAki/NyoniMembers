import type { Metadata } from "next";
import { OutfitBuilder } from "@/components/outfits/outfit-builder";
import type { Id } from "@convex/_generated/dataModel";
import { requireSignedIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Outfit",
  description: "Edit the look and render it on yourself.",
};

export default async function OutfitPage({ params }: PageProps<"/outfits/[outfitId]">) {
  await requireSignedIn();
  const { outfitId } = await params;
  // Convex ids are opaque branded strings; the query rejects anything that is not the user's outfit.
  return <OutfitBuilder mode="edit" outfitId={outfitId as Id<"outfits">} />;
}
