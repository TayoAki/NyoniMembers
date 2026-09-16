import type { Metadata } from "next";
import { ItemDetail } from "@/components/wardrobe/item-detail";
import type { Id } from "@convex/_generated/dataModel";
import { requireSignedIn } from "@/lib/auth";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params }: PageProps<"/wardrobe/[itemId]">) {
  await requireSignedIn();
  const { itemId } = await params;
  // Route params are strings; the query rejects anything that is not a real item id.
  return <ItemDetail itemId={itemId as Id<"items">} />;
}
