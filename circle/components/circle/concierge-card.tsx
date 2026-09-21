import { View } from "react-native";
import { TextAction } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

/**
 * The human channel, kept visibly separate from the advisor. No portrait is shipped here because
 * none has been supplied and a stock face would misrepresent the staff.
 */
export function ConciergeCard({ name, blurb, onContact }: { name: string; blurb: string; onContact: () => void }) {
  const surface = useSurface();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");

  return (
    <View
      style={{
        flexDirection: "row",
        gap: space.x4,
        padding: space.x4,
        borderRadius: radius.card,
        backgroundColor: surface.well,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: surface.controlLine,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="eyebrow" tone="muted">
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1, gap: space.x2 }}>
        <Text variant="caption" tone="muted">
          {blurb}
        </Text>
        <TextAction label="Contact the house" onPress={onContact} />
      </View>
    </View>
  );
}
