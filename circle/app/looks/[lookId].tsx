import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { lookById, pieceById, productById } from "@/lib/fixtures";
import { money, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { SLOT_LABELS, SLOTS } from "@/lib/types";

/** A saved look, and the thing that makes it commercial: which pieces are not yours yet. */
export default function LookDetail() {
  const { lookId } = useLocalSearchParams<{ lookId: string }>();
  const router = useRouter();
  const { hasAtelier } = useSession();
  const look = lookById(lookId);

  if (!look) {
    return (
      <Screen>
        <EmptyState
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
          label={hasAtelier ? "Try this look" : "Preview it with Atelier"}
          onPress={() => router.push(hasAtelier ? "/try-on" : "/atelier")}
        />
      }
    >
      <PageHeading
        eyebrow={`${look.occasion ?? "A look"} · saved ${relativeDate(look.createdAt)}`}
        title={look.title}
        subtitle={look.source === "stylist" ? "Put together by the Nyoni stylist." : undefined}
      />

      <View style={{ gap: space.x3 }}>
        {rows.map(({ slot, piece }) =>
          piece ? (
            <Pressable
              key={piece.id}
              accessibilityRole="link"
              accessibilityLabel={`${SLOT_LABELS[slot]}, ${piece.name}`}
              onPress={() => router.push({ pathname: "/wardrobe/[pieceId]", params: { pieceId: piece.id } })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.x3,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ImageWell productId={piece.productId} label={piece.name} isolated style={{ width: 64 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="eyebrow" tone="muted">
                  {SLOT_LABELS[slot]}
                </Text>
                <Text variant="productTitle">{piece.name}</Text>
                <Text variant="eyebrow" tone={piece.source === "owned" ? "muted" : "accent"}>
                  {piece.source === "owned" ? "You own" : "Nyoni"}
                </Text>
              </View>
            </Pressable>
          ) : null,
        )}
      </View>

      {missing.length > 0 ? (
        <Section title="Shop the missing pieces">
          <OutlinePanel>
            <Text variant="body" tone="muted">
              {missing.length} of these are house pieces you do not own yet, {money(missingTotal)} in total. Only the
              unowned pieces are included.
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
          </OutlinePanel>
        </Section>
      ) : null}

      <Section>
        <Button label="Wear it today" variant="secondary" onPress={() => router.push("/calendar")} />
      </Section>
    </Screen>
  );
}
