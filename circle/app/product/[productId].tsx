import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { productById } from "@/lib/fixtures";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/** Price, size and availability legible without scrolling back, and one way to try it on. */
export default function ProductDetail() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const colours = useColours();
  const { hasAtelier } = useSession();
  const product = productById(productId);
  const [size, setSize] = useState<string | null>(null);

  if (!product) {
    return (
      <Screen>
        <EmptyBlock
          title="Not in the catalogue"
          description="This piece is no longer listed by the house."
          actionLabel="Back to drops"
          onAction={() => router.replace("/drops")}
        />
      </Screen>
    );
  }

  const chosen = product.variations.find((variation) => variation.size === size);
  const soldOut = product.variations.every((variation) => !variation.inStock);

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button
            label={soldOut ? "Sold out" : size ? `Add ${size} to bag` : "Choose a size"}
            size="lg"
            disabled={soldOut || !size || !chosen?.inStock}
            onPress={() => router.push("/bag")}
          />
          <Text variant="bodySmall" tone="muted" center>
            Checkout opens on nyonicouture.com, where the house takes payment.
          </Text>
        </View>
      }
    >
      <Photo productId={product.id} fallbackLabel={product.name} />

      <View style={{ paddingTop: space.xl, gap: space.sm }}>
        <Text variant="eyebrow" tone="muted">
          {product.subcategory}
        </Text>
        <Text variant="title">{product.name}</Text>
        <Text variant="price">{money(product.priceUsd)}</Text>
      </View>

      <Section title="Size">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {product.variations.map((variation) => {
            const active = size === variation.size;
            return (
              <Pressable
                key={variation.size}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: !variation.inStock }}
                accessibilityLabel={`${variation.size}${variation.inStock ? "" : ", out of stock"}`}
                disabled={!variation.inStock}
                onPress={() => setSize(variation.size)}
                style={{
                  minWidth: 64,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: active ? colours.primary : colours.border,
                  backgroundColor: active ? colours.primary : "transparent",
                  opacity: variation.inStock ? 1 : 0.35,
                }}
              >
                <Text variant="label" tone={active ? "onPrimary" : "default"}>
                  {variation.size}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {size && !chosen?.inStock ? (
          <Text variant="bodySmall" tone="warning">
            That size is out of stock. Your clothier can tell you when it returns.
          </Text>
        ) : null}
      </Section>

      <Section>
        <Button
          label={hasAtelier ? "See it on you" : "Preview it on you"}
          variant="secondary"
          onPress={() => router.push("/try-on")}
        />
      </Section>

      <Section title="The cloth">
        <Card>
          <Row label="Colour" value={product.colour} />
          <Row label="Pattern" value={product.pattern} />
          <Row label="Material" value={product.material} />
          <Row label="Worn for" value={product.formality} />
        </Card>
      </Section>

      <Section title="Fit">
        <Text variant="bodySmall" tone="muted">
          Sizes here are the house's ready cuts. A made-to-measure commission starts with a fitting, and your clothier
          will tell you which of the two is right for this piece.
        </Text>
        <Button label="Book a fitting" variant="secondary" onPress={() => router.push("/circle/appointments")} />
      </Section>
    </Screen>
  );
}
