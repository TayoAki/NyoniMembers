import { View } from "react-native";
import { Card, Row } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { orders, productById } from "@/lib/fixtures";
import { longDate, money } from "@/lib/format";
import { space } from "@/lib/theme";

const STATUS_LABELS = {
  pending: "Awaiting payment",
  processing: "With the house",
  completed: "Delivered",
  cancelled: "Cancelled",
} as const;

export default function Orders() {
  if (orders.length === 0) {
    return (
      <Screen>
        <EmptyBlock title="No orders yet" description="Anything you buy from the house appears here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader eyebrow="From the house" title="Your orders" />

      <View style={{ gap: space.lg }}>
        {orders.map((order) => (
          <Card key={order.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text variant="subheading">{order.reference}</Text>
              <Text variant="eyebrow" tone={order.status === "completed" ? "success" : "primary"}>
                {STATUS_LABELS[order.status]}
              </Text>
            </View>
            <Text variant="eyebrow" tone="muted">
              {longDate(order.placedAt)}
            </Text>
            {order.lines.map((line) => (
              <Row
                key={`${line.productId}-${line.size}`}
                label={`${productById(line.productId)?.name ?? "Piece"} · ${line.size}`}
                value={money(line.priceUsd * line.qty)}
              />
            ))}
            <Row label="Total" value={money(order.totalUsd)} tone="default" />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
