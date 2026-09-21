import { Link } from "expo-router";
import { Pressable, View, type ViewStyle } from "react-native";
import { money } from "@/lib/format";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";
import type { Piece, Product } from "@/lib/types";
import { Photo } from "./photo";
import { Text } from "./text";

/** A piece on sale. Price and availability are legible before anyone opens the product screen. */
export function ProductCard({ product, style }: { product: Product; style?: ViewStyle }) {
  const colours = useColours();
  const soldOut = product.variations.every((variation) => !variation.inStock);

  return (
    <Link href={{ pathname: "/product/[productId]", params: { productId: product.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${money(product.priceUsd)}${soldOut ? ", sold out" : ""}`}
        style={({ pressed }) => [{ gap: space.sm, opacity: pressed ? 0.85 : 1 }, style]}
      >
        <Photo productId={product.id} fallbackLabel={product.name} />
        <View style={{ gap: 2 }}>
          <Text variant="label" numberOfLines={2}>
            {product.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text variant="bodySmall" tone="muted">
              {money(product.priceUsd)}
            </Text>
            {soldOut ? (
              <Text variant="eyebrow" tone="muted" style={{ color: colours.warning }}>
                Sold out
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** A garment in the member's own wardrobe. Shows where it came from, not what it costs. */
export function PieceCard({ piece, style }: { piece: Piece; style?: ViewStyle }) {
  const source = { owned: "Your own", purchased: "Bought from the house", house: "The Nyoni capsule" }[piece.source];

  return (
    <Link href={{ pathname: "/wardrobe/[pieceId]", params: { pieceId: piece.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${piece.name}, ${source}`}
        style={({ pressed }) => [{ gap: space.sm, opacity: pressed ? 0.85 : 1 }, style]}
      >
        <Photo productId={piece.productId} fallbackLabel={piece.name} />
        <View style={{ gap: 2 }}>
          <Text variant="label" numberOfLines={2}>
            {piece.name}
          </Text>
          <Text variant="eyebrow" tone="muted">
            {source}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/** A bordered block used for anything that is an object rather than a list row. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const colours = useColours();
  return (
    <View
      style={[
        {
          padding: space.lg,
          gap: space.md,
          borderWidth: 1,
          borderColor: colours.border,
          borderRadius: radius.lg,
          backgroundColor: colours.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A label-and-value row, used for attributes, totals and anything tabular. */
export function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "primary";
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.lg }}>
      <Text variant="bodySmall" tone="muted">
        {label}
      </Text>
      <Text variant="bodySmall" tone={tone} style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

/** A tappable list row with a chevron, for navigation lists such as the Circle menu. */
export function NavRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  const colours = useColours();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.md,
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: colours.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="body">{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {detail ? (
          <Text variant="bodySmall" tone="muted">
            {detail}
          </Text>
        ) : null}
        <Text variant="body" tone="muted">
          ›
        </Text>
      </View>
    </Pressable>
  );
}
