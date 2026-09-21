import { useRouter } from "expo-router";
import { View } from "react-native";
import { atelier } from "@/lib/fixtures";
import { money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * The fifth state. A locked feature never dead-ends: it names what Atelier is, what it costs and how
 * long the preview runs, then offers the way in. Apple requires the price and period to be legible
 * before anyone taps buy, and a member deserves it regardless.
 */
export function LockedBlock({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  const colours = useColours();
  const router = useRouter();
  const { previewDaysLeft } = useSession();

  return (
    <View
      style={{
        padding: compact ? space.lg : space.xl,
        gap: space.md,
        borderWidth: 1,
        borderColor: colours.locked,
        borderRadius: radius.lg,
        backgroundColor: colours.surface,
      }}
    >
      <Text variant="eyebrow" tone="primary">
        Atelier
      </Text>
      <Text variant={compact ? "subheading" : "heading"}>{title}</Text>
      <Text variant="bodySmall" tone="muted">
        {description}
      </Text>
      <Text variant="bodySmall" tone="muted">
        {money(atelier.annualUsd)} a year, or {money(atelier.monthlyUsd)} a month. Included with Signature membership
        and above.
        {previewDaysLeft > 0 ? ` Your preview has ${previewDaysLeft} days left.` : ""}
      </Text>
      <Button label="See what Atelier includes" onPress={() => router.push("/atelier")} />
    </View>
  );
}
