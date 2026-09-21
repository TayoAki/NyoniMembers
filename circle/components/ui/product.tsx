import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, View, type ViewStyle } from "react-native";
import { pieceImage } from "@/lib/images";
import { radius, ratio, space } from "@/lib/theme";
import type { Product } from "@/lib/types";
import { useSurface } from "@/lib/use-theme";
import { TextAction } from "./button";
import { Text } from "./text";

/**
 * Photography always sits in a warm neutral well, never on an arbitrary white box. Modelled
 * clothing is cropped to 3:4 and covers its frame; an isolated piece is 4:5 and is contained so
 * sleeves, shoes and hems keep their edges.
 */
export function ImageWell({
  productId,
  label,
  isolated = false,
  aspect,
  style,
}: {
  productId?: string;
  label: string;
  isolated?: boolean;
  aspect?: number;
  style?: ViewStyle;
}) {
  const surface = useSurface();
  const source = productId ? pieceImage(productId) : undefined;

  return (
    <View
      style={[
        {
          aspectRatio: aspect ?? (isolated ? ratio.isolated : ratio.modelled),
          borderRadius: radius.sm,
          backgroundColor: surface.well,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          contentFit={isolated ? "contain" : "cover"}
          transition={140}
          style={{ width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
          alt={label}
        />
      ) : (
        <View style={{ paddingHorizontal: space.x3 }}>
          <Text variant="caption" tone="muted" center numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * A product card. The title sits outside the photograph and wraps to two lines, and the whole card
 * is one link, so there is no button nested inside a clickable card.
 */
export function ProductCard({
  product,
  memberAccess = false,
  style,
}: {
  product: Product;
  /** Drops mark member merchandise; the wardrobe does not. */
  memberAccess?: boolean;
  style?: ViewStyle;
}) {
  const soldOut = product.variations.every((variation) => !variation.inStock);

  return (
    <Link href={{ pathname: "/product/[productId]", params: { productId: product.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${product.name}${soldOut ? ", sold out" : ""}`}
        style={({ pressed }) => [{ gap: space.x2, opacity: pressed ? 0.86 : 1 }, style]}
      >
        <ImageWell productId={product.id} label={product.name} />
        <View style={{ gap: space.x1 }}>
          <Text variant="productTitle" numberOfLines={2}>
            {product.name}
          </Text>
          {memberAccess ? (
            <Text variant="eyebrow" tone="muted">
              Member access
            </Text>
          ) : null}
          {soldOut ? (
            <Text variant="eyebrow" tone="error">
              Sold out
            </Text>
          ) : null}
          <View pointerEvents="none">
            <Text variant="caption" style={{ textDecorationLine: "underline" }}>
              View piece
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Two equal columns with a 12pt gutter, per the style guide's mobile grid. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x3, rowGap: space.x5 }}>{children}</View>;
}

/** Sizes the children of a two-column grid without every screen repeating the arithmetic. */
export const gridItem: ViewStyle = { width: "47.5%", flexGrow: 1 };

/** A warm inset row: thumbnail, name, and an action aligned at the end. */
export function SelectedGarmentRow({
  productId,
  name,
  actionLabel,
  onAction,
}: {
  productId?: string;
  name: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const surface = useSurface();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.x3,
        padding: space.x3,
        borderRadius: radius.sm,
        backgroundColor: surface.well,
      }}
    >
      <ImageWell productId={productId} label={name} isolated style={{ width: 52 }} />
      <Text variant="productTitle" style={{ flex: 1 }} numberOfLines={2}>
        {name}
      </Text>
      <TextAction label={actionLabel} onPress={onAction} arrow />
    </View>
  );
}
