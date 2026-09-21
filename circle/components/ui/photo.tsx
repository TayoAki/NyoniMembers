import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";
import { pieceImage } from "@/lib/images";
import { radius, ratio, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";
import { Text } from "./text";

/**
 * House photography is shot on a light studio background, so in dark mode it sits on a cream tile
 * rather than floating on onyx. Everything is 4:5 portrait. A garment the member photographed
 * themselves has no house image, so it falls back to its initials on the same tile.
 */
export function Photo({
  productId,
  fallbackLabel,
  aspect = ratio.portrait,
  style,
  contentFit = "contain",
}: {
  productId?: string;
  fallbackLabel?: string;
  aspect?: number;
  style?: ViewStyle;
  contentFit?: "contain" | "cover";
}) {
  const colours = useColours();
  const source = productId ? pieceImage(productId) : undefined;

  return (
    <View
      style={[
        {
          aspectRatio: aspect,
          borderRadius: radius.md,
          backgroundColor: colours.photo,
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
          contentFit={contentFit}
          transition={160}
          style={{ width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={{ padding: space.md }}>
          <Text variant="eyebrow" style={{ color: "#6B665C" }} center>
            {initials(fallbackLabel ?? "Nyoni")}
          </Text>
        </View>
      )}
    </View>
  );
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}
