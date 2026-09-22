import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View, type ViewStyle } from "react-native";
import { pieceImage } from "@/lib/images";
import { ny, radius, ratio, space } from "@/lib/theme";
import { SurfaceProvider, useGutter } from "@/lib/use-theme";
import { Text } from "./text";

/**
 * Photography carries the richness, so editorial text sits over it with a scrim behind it rather
 * than baked into the image. The text is real headings and links, laid out in normal flow at the
 * foot of the frame, so nothing overlaps when a line wraps or the type size grows.
 */
export function EditorialHero({
  productId,
  eyebrow,
  title,
  caption,
  actionLabel,
  onAction,
}: {
  productId: string;
  eyebrow: string;
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const gutter = useGutter();

  return (
    <SurfaceProvider tone="dark">
      <View style={{ backgroundColor: ny.ink }}>
        <Image
          source={pieceImage(productId)}
          contentFit="cover"
          style={{ width: "100%", aspectRatio: ratio.modelled }}
          accessibilityIgnoresInvertColors
          alt={title}
        />
        <LinearGradient
          colors={["transparent", "rgba(12,12,11,0.55)", ny.ink]}
          locations={[0, 0.55, 1]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" }}
          pointerEvents="none"
        />
        <View style={{ paddingHorizontal: gutter, paddingTop: space.x5, paddingBottom: space.x6, gap: space.x3 }}>
          <Text variant="eyebrow" tone="accent">
            {eyebrow}
          </Text>
          <Text variant="hero" accessibilityRole="header">
            {title}
          </Text>
          {caption ? <Text variant="section">{caption}</Text> : null}
          {actionLabel && onAction ? (
            <View style={{ alignSelf: "flex-start", paddingTop: space.x1 }}>
              <GoldAction label={actionLabel} onPress={onAction} />
            </View>
          ) : null}
        </View>
      </View>
    </SurfaceProvider>
  );
}

/** The champagne discovery action from the home screen: gold fill, ink text. */
function GoldAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: space.x5,
        borderRadius: radius.sm,
        backgroundColor: ny.gold,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <Text variant="button" style={{ color: ny.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A shorter landscape feature, used to lead the drops page. */
export function EditorialCard({
  productId,
  title,
  actionLabel,
  onPress,
  style,
}: {
  productId: string;
  title: string;
  actionLabel: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${actionLabel}`}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, borderRadius: radius.sm, overflow: "hidden" }, style]}
    >
      <SurfaceProvider tone="dark">
        <View>
          <Image
            source={pieceImage(productId)}
            contentFit="cover"
            style={{ width: "100%", aspectRatio: ratio.feature }}
            accessibilityIgnoresInvertColors
            alt={title}
          />
          <LinearGradient
            colors={["transparent", "rgba(12,12,11,0.78)"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" }}
            pointerEvents="none"
          />
          <View style={{ position: "absolute", left: space.x4, right: space.x4, bottom: space.x4, gap: space.x1 }}>
            <Text variant="editorial" accessibilityRole="header">
              {title}
            </Text>
            <View pointerEvents="none">
              <Text variant="button" style={{ color: ny.ivory, textDecorationLine: "underline" }}>
                {actionLabel}
              </Text>
            </View>
          </View>
        </View>
      </SurfaceProvider>
    </Pressable>
  );
}

export { GoldAction };
