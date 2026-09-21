import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { pieceById, productById } from "@/lib/fixtures";
import { costPerWear, longDate, money, pluralize } from "@/lib/format";
import { space } from "@/lib/theme";

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
        <EmptyBlock
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
      <Photo productId={piece.productId} fallbackLabel={piece.name} />

      <View style={{ paddingTop: space.xl, gap: space.sm }}>
        <Text variant="eyebrow" tone="muted">
          {SOURCE_LABELS[piece.source]}
        </Text>
        <Text variant="title">{piece.name}</Text>
      </View>

      <Section title="How you wear it">
        <Card>
          <Row label="Worn" value={pluralize(piece.wearCount, "time")} />
          <Row label="Cost per wear" value={costPerWear(piece.costUsd, piece.wearCount)} />
          {piece.costUsd !== undefined ? <Row label="Paid" value={money(piece.costUsd)} /> : null}
          <Row label="Added" value={longDate(piece.addedAt)} />
        </Card>
      </Section>

      <Section title="The piece">
        <Card>
          <Row label="Category" value={piece.subcategory} />
          <Row label="Colour" value={piece.colour} />
          {piece.size ? <Row label="Size" value={piece.size} /> : null}
          {product ? <Row label="House price" value={money(product.priceUsd)} /> : null}
        </Card>
      </Section>

      <Section>
        <Button label="Use it in a look" onPress={() => router.push("/looks/new")} />
        <Button label="Wear it today" variant="secondary" onPress={() => router.push("/calendar")} />
        {product ? (
          <Button
            label="See it in the shop"
            variant="ghost"
            onPress={() => router.push({ pathname: "/product/[productId]", params: { productId: product.id } })}
          />
        ) : null}
      </Section>
    </Screen>
  );
}
