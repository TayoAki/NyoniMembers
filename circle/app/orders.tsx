import { View } from "react-native";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
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
        <EmptyState title="No orders yet" description="Anything you buy from the house appears here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeading eyebrow="From the house" title="Your orders" />

      <View style={{ gap: space.x5, paddingTop: space.x2 }}>
        {orders.map((order) => (
          <OutlinePanel key={order.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text variant="section">{order.reference}</Text>
              <Text variant="eyebrow" tone={order.status === "completed" ? "success" : "accent"}>
                {STATUS_LABELS[order.status]}
              </Text>
            </View>
            <Text variant="eyebrow" tone="muted">
              {longDate(order.placedAt)}
            </Text>
            {order.lines.map((line) => (
              <DetailRow
                key={`${line.productId}-${line.size}`}
                label={`${productById(line.productId)?.name ?? "Piece"} · ${line.size}`}
                value={money(line.priceUsd * line.qty)}
              />
            ))}
            <DetailRow label="Total" value={money(order.totalUsd)} />
          </OutlinePanel>
        ))}
      </View>
    </Screen>
  );
}
