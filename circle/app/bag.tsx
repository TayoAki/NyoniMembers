import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState, InlineNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { bag, productById } from "@/lib/fixtures";
import { money, pluralize } from "@/lib/format";
import { space } from "@/lib/theme";

/**
 * The bag hands off to the house's own checkout, because Apple requires payment for physical goods
 * to happen outside in-app purchase. The screen says where the member is going before it sends them.
 */
export default function Bag() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  const lines = bag.map((line) => ({ line, product: productById(line.productId) })).filter((entry) => entry.product);
  const subtotal = lines.reduce((sum, entry) => sum + (entry.product?.priceUsd ?? 0) * entry.line.qty, 0);

  async function checkout() {
    setOpening(true);
    setFailed(false);
    try {
      await WebBrowser.openBrowserAsync("https://nyonicouture.com/checkout/");
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }

  if (lines.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Your bag is empty"
          description="Everything the house has open right now is in Drops."
          actionLabel="See the drops"
          onAction={() => router.replace("/drops")}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space.x2 }}>
          <Button label="Checkout on nyonicouture.com" pending={opening} onPress={() => void checkout()} />
          <Text variant="caption" tone="muted" center>
            Opening the house's checkout is not a completed order. Your order appears here once it is placed.
          </Text>
        </View>
      }
    >
      <PageHeading title="Your bag" subtitle={`${pluralize(lines.length, "piece")} to consider.`} />

      {failed ? (
        <InlineNotice
          tone="error"
          title="The checkout would not open"
          description="Your bag is untouched. Try again, or open nyonicouture.com in your browser."
          actionLabel="Try again"
          onAction={() => void checkout()}
        />
      ) : null}

      <View style={{ gap: space.x5, paddingTop: space.x4 }}>
        {lines.map(({ line, product }) =>
          product ? (
            <View key={`${line.productId}-${line.size}`} style={{ flexDirection: "row", gap: space.x3 }}>
              <ImageWell productId={product.id} label={product.name} isolated style={{ width: 76 }} />
              <View style={{ flex: 1, gap: space.x1 }}>
                <Text variant="productTitle">{product.name}</Text>
                <Text variant="eyebrow" tone="muted">
                  Size {line.size} · {line.qty > 1 ? `${line.qty} of them` : "one"}
                </Text>
                <Text variant="button">{money(product.priceUsd * line.qty)}</Text>
              </View>
            </View>
          ) : null,
        )}
      </View>

      <Section title="Total">
        <OutlinePanel>
          <DetailRow label="Subtotal" value={money(subtotal)} />
          <DetailRow label="Shipping and tax" value="Calculated at checkout" />
        </OutlinePanel>
      </Section>

      <Section>
        <TextAction label="See your orders" onPress={() => router.push("/orders")} />
      </Section>
    </Screen>
  );
}
