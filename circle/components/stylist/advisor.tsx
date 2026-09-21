import { View } from "react-native";
import { ny, radius, space } from "@/lib/theme";
import { Text } from "@/components/ui/text";

/**
 * The badge that marks a machine answer. Restrained gold with ink text, because the member has to
 * be able to tell an advisor's suggestion from a clothier's word at a glance.
 */
export function AdvisorBadge() {
  return (
    <View
      accessible
      accessibilityLabel="Answers in this conversation come from an AI style advisor"
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: space.x2,
        paddingVertical: space.x1,
        borderRadius: radius.sm,
        backgroundColor: ny.gold,
      }}
    >
      <Text variant="eyebrow" style={{ color: ny.ink }}>
        AI style advisor
      </Text>
    </View>
  );
}
