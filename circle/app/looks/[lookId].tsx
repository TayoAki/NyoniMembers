import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { lookById, pieceById, productById } from "@/lib/fixtures";
import { money, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { SLOTS, SLOT_LABELS } from "@/lib/types";

/** A saved look, and the thing that makes it commercial: which pieces are not yours yet. */
export default function LookDetail() {
  const { lookId } = useLocalSearchParams<{ lookId: string }>();
  const router = useRouter();
  const { hasAtelier } = useSession();
  const look = lookById(lookId);

  if (!look) {
    return (
      <Screen>
        <EmptyBlock
          title="That look is gone"
          description="It may have been deleted, or a piece in it was removed from your wardrobe."
          actionLabel="Back to your wardrobe"
          onAction={() => router.replace("/wardrobe")}
        />
      </Screen>
    );
  }

  const rows = SLOTS.flatMap((slot) =>
    (look.slots[slot] ?? []).map((pieceId) => ({ slot, piece: pieceById(pieceId) })),
  ).filter((row) => row.piece);

  const missing = rows.filter((row) => row.piece?.source === "house" && row.piece.productId);
  const missingTotal = missing.reduce((sum, row) => sum + (productById(row.piece?.productId ?? "")?.priceUsd ?? 0), 0);

  return (
    <Screen
      footer={
        <Button
          label={hasAtelier ? "Preview it on you" : "Preview it with Atelier"}
          size="lg"
          onPress={() => router.push("/try-on")}
        />
      }
    >
      <ScreenHeader
        eyebrow={`${look.occasion ?? "A look"} · saved ${relativeDate(look.createdAt)}`}
        title={look.title}
        description={look.source === "concierge" ? "Put together by your concierge." : undefined}
      />

      <View style={{ gap: space.md }}>
        {rows.map(({ slot, piece }) =>
          piece ? (
            <Pressable
              key={piece.id}
              accessibilityRole="button"
              accessibilityLabel={`${SLOT_LABELS[slot]}, ${piece.name}`}
              onPress={() => router.push({ pathname: "/wardrobe/[pieceId]", params: { pieceId: piece.id } })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Photo productId={piece.productId} fallbackLabel={piece.name} style={{ width: 64 }} />
              <View style={{ flex: 1 }}>
                <Text variant="eyebrow" tone="muted">
                  {SLOT_LABELS[slot]}
                </Text>
                <Text variant="label">{piece.name}</Text>
              </View>
            </Pressable>
          ) : null,
        )}
      </View>

      {missing.length > 0 ? (
        <Section title="Shop the missing pieces">
          <Card>
            <Text variant="bodySmall" tone="muted">
              {missing.length} of these are house pieces you do not own yet, {money(missingTotal)} in total.
            </Text>
            {missing.map(({ piece }) => {
              const product = piece?.productId ? productById(piece.productId) : undefined;
              return product ? (
                <Button
                  key={product.id}
                  label={`${product.name} · ${money(product.priceUsd)}`}
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/product/[productId]", params: { productId: product.id } })}
                />
              ) : null;
            })}
          </Card>
        </Section>
      ) : null}

      <Section>
        <Button label="Wear it today" variant="secondary" onPress={() => router.push("/calendar")} />
      </Section>
    </Screen>
  );
}
