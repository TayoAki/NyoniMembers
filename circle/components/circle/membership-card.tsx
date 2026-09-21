import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { Wordmark } from "@/components/ui/wordmark";
import { Text } from "@/components/ui/text";
import { ny, radius, ratio, space } from "@/lib/theme";

/**
 * The member card. The texture is decoration and is hidden from assistive technology; the tier and
 * status beside it are live text, never lettering baked into an image.
 */
export function MembershipCard({ tier, status }: { tier: string; status: string }) {
  return (
    <View
      style={{
        aspectRatio: ratio.memberCard,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: ny.darkLine,
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      <LinearGradient
        colors={["#1F1D19", "#121210", "#1A1815"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={{ alignItems: "center", gap: space.x4, paddingHorizontal: space.x5 }}>
        <Wordmark />
        <Text
          variant="editorial"
          style={{ color: ny.gold, letterSpacing: 6, marginRight: -6 }}
          accessibilityLabel={`${tier} member`}
        >
          {tier.toUpperCase()}
        </Text>
        <Text variant="eyebrow" style={{ color: ny.darkMuted }}>
          {status}
        </Text>
      </View>
    </View>
  );
}
