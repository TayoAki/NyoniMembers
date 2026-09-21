import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { pieceById, productById } from "@/lib/fixtures";
import { costPerWear, longDate, money, pluralize } from "@/lib/format";

const SOURCE_LABELS = {
  owned: "Photographed by you",
  purchased: "Bought from the house",
  house: "The Nyoni capsule",
} as const;

export default function PieceDetail() {
  const { pieceId } = useLocalSearchParams<{ pieceId: string }>();
  const router = useRouter();
  const piece = pieceById(pieceId);

  if (!piece) {
    return (
      <Screen>
        <EmptyState
          title="Not in your wardrobe"
          description="This piece may have been removed."
          actionLabel="Back to the wardrobe"
          onAction={() => router.replace("/wardrobe")}
        />
      </Screen>
    );
  }

  const product = piece.productId ? productById(piece.productId) : undefined;

  return (
    <Screen>
      <ImageWell productId={piece.productId} label={piece.name} isolated />
      <PageHeading eyebrow={SOURCE_LABELS[piece.source]} title={piece.name} />

      <Section title="How you wear it">
        <OutlinePanel>
          <DetailRow label="Worn" value={pluralize(piece.wearCount, "time")} />
          <DetailRow label="Cost per wear" value={costPerWear(piece.costUsd, piece.wearCount)} />
          {piece.costUsd !== undefined ? <DetailRow label="Paid" value={money(piece.costUsd)} /> : null}
          <DetailRow label="Added" value={longDate(piece.addedAt)} />
        </OutlinePanel>
      </Section>

      <Section title="The piece">
        <OutlinePanel>
          <DetailRow label="Category" value={piece.subcategory} />
          <DetailRow label="Colour" value={piece.colour} />
          {piece.size ? <DetailRow label="Size" value={piece.size} /> : null}
          {product ? <DetailRow label="House price" value={money(product.priceUsd)} /> : null}
        </OutlinePanel>
      </Section>

      <Section>
        <Button label="Use it in a look" onPress={() => router.push("/looks/new")} />
        <Button label="Wear it today" variant="secondary" onPress={() => router.push("/calendar")} />
        {product ? (
          <Button
            label="See it in the shop"
            variant="secondary"
            onPress={() => router.push({ pathname: "/product/[productId]", params: { productId: product.id } })}
          />
        ) : null}
      </Section>
    </Screen>
  );
}
