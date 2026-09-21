import { useRouter } from "expo-router";
import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { bag, productById } from "@/lib/fixtures";
import { money } from "@/lib/format";
import { space } from "@/lib/theme";

/**
 * The bag hands off to the house's own checkout. That is not a shortcut: Apple requires payment for
 * physical goods to happen outside in-app purchase, so the screen says where the member is going
 * before it sends them there.
 */
export default function Bag() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const lines = bag.map((line) => ({ line, product: productById(line.productId) })).filter((entry) => entry.product);
  const subtotal = lines.reduce((sum, entry) => sum + (entry.product?.priceUsd ?? 0) * entry.line.qty, 0);

  async function checkout() {
    setOpening(true);
    try {
      // M4 replaces this with the order-pay URL Convex gets back from WooCommerce.
      await WebBrowser.openBrowserAsync("https://nyonicouture.com/checkout/");
    } finally {
      setOpening(false);
    }
  }

  if (lines.length === 0) {
    return (
      <Screen>
        <EmptyBlock
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
        <View style={{ gap: space.sm }}>
          <Button label="Checkout on nyonicouture.com" size="lg" pending={opening} onPress={() => void checkout()} />
          <Text variant="bodySmall" tone="muted" center>
            The house takes payment on its own site. Your order appears here once it is placed.
          </Text>
        </View>
      }
    >
      <ScreenHeader eyebrow="Your bag" title={`${lines.length} to consider`} />

      <View style={{ gap: space.lg }}>
        {lines.map(({ line, product }) =>
          product ? (
            <View key={`${line.productId}-${line.size}`} style={{ flexDirection: "row", gap: space.md }}>
              <Photo productId={product.id} fallbackLabel={product.name} style={{ width: 72 }} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="label">{product.name}</Text>
                <Text variant="eyebrow" tone="muted">
                  Size {line.size} · {line.qty > 1 ? `${line.qty} of them` : "one"}
                </Text>
                <Text variant="price">{money(product.priceUsd * line.qty)}</Text>
              </View>
            </View>
          ) : null,
        )}
      </View>

      <Section title="Total">
        <Card>
          <Row label="Subtotal" value={money(subtotal)} />
          <Row label="Shipping and tax" value="Calculated at checkout" />
        </Card>
      </Section>

      <Section>
        <Button label="See your orders" variant="ghost" onPress={() => router.push("/orders")} />
      </Section>
    </Screen>
  );
}
