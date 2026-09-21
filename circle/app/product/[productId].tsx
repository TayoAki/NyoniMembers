import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState, InlineNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { productById } from "@/lib/fixtures";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { chrome, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

/** Price, size and availability legible without scrolling back, and one way to see it on yourself. */
export default function ProductDetail() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const surface = useSurface();
  const { hasAtelier } = useSession();
  const product = productById(productId);
  const [size, setSize] = useState<string | null>(null);

  if (!product) {
    return (
      <Screen>
        <EmptyState
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
        <View style={{ gap: space.x2 }}>
          <Button
            label={soldOut ? "Sold out" : size ? `Add ${size} to bag` : "Choose a size"}
            disabled={soldOut || !size || !chosen?.inStock}
            onPress={() => router.push("/bag")}
          />
          <Text variant="caption" tone="muted" center>
            Checkout opens on nyonicouture.com, where the house takes payment.
          </Text>
        </View>
      }
    >
      <ImageWell productId={product.id} label={product.name} isolated />

      <PageHeading eyebrow={product.subcategory} title={product.name} />
      <Text variant="section">{money(product.priceUsd)}</Text>

      {soldOut ? (
        <Section>
          <InlineNotice
            title="Sold out"
            description="Your clothier can tell you when it returns, or suggest a piece that is cut the same way."
            actionLabel="Speak to your clothier"
            onAction={() => router.push("/circle/clothier")}
          />
        </Section>
      ) : (
        <Section title="Size">
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Choose a size"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x2 }}
          >
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
                    minHeight: chrome.tapTarget,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: space.x3,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: active ? surface.text : surface.controlLine,
                    backgroundColor: active ? surface.text : "transparent",
                    opacity: variation.inStock ? 1 : 0.4,
                  }}
                >
                  <Text variant="button" style={{ color: active ? surface.background : surface.text }}>
                    {variation.size}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {size && !chosen?.inStock ? (
            <Text variant="caption" tone="error">
              That size is out of stock.
            </Text>
          ) : null}
        </Section>
      )}

      <Section>
        <Button
          label={hasAtelier ? "See it on you" : "Preview it with Atelier"}
          variant="secondary"
          onPress={() => router.push(hasAtelier ? "/try-on" : "/atelier")}
        />
      </Section>

      <Section title="The cloth">
        <OutlinePanel>
          <DetailRow label="Colour" value={product.colour} />
          <DetailRow label="Pattern" value={product.pattern} />
          <DetailRow label="Material" value={product.material} />
          <DetailRow label="Worn for" value={product.formality} />
        </OutlinePanel>
      </Section>

      <Section title="Fit">
        <Text variant="body" tone="muted">
          Sizes here are the house's ready cuts. A made-to-measure commission starts with a fitting, and your clothier
          will tell you which of the two is right for this piece.
        </Text>
        <TextAction label="Book a fitting" onPress={() => router.push("/circle/appointments")} />
      </Section>
    </Screen>
  );
}
