import { View } from "react-native";
import { Card, Row } from "@/components/ui/cards";
import { LockedBlock } from "@/components/ui/locked-block";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { pieces, wears } from "@/lib/fixtures";
import { money, pluralize } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

/** Atelier's dashboard. Every number here is derived from the wardrobe, not invented. */
export default function Analytics() {
  const colours = useColours();
  const { hasAtelier } = useSession();

  if (!hasAtelier) {
    return (
      <Screen>
        <LockedBlock
          title="Your wardrobe, measured"
          description="What you actually reach for, what each piece costs you per wear, and where the gaps are."
        />
      </Screen>
    );
  }

  const totalWorn = pieces.reduce((sum, piece) => sum + piece.wearCount, 0);
  const invested = pieces.reduce((sum, piece) => sum + (piece.costUsd ?? 0), 0);
  const unworn = pieces.filter((piece) => piece.wearCount === 0);
  const mostWorn = [...pieces].sort((a, b) => b.wearCount - a.wearCount).slice(0, 5);
  const byCategory = CATEGORIES.map((category) => ({
    category,
    count: pieces.filter((piece) => piece.category === category).length,
  })).filter((entry) => entry.count > 0);
  const largest = Math.max(...byCategory.map((entry) => entry.count), 1);

  return (
    <Screen>
      <ScreenHeader eyebrow="Atelier" title="Your wardrobe" description="What you own, and what you actually wear." />

      <View style={{ flexDirection: "row", gap: space.md }}>
        <Stat label="Pieces" value={String(pieces.length)} />
        <Stat label="Wears logged" value={String(totalWorn)} />
        <Stat label="Invested" value={money(invested)} />
      </View>

      <Section title="What it is made of">
        <Card>
          {byCategory.map((entry) => (
            <View key={entry.category} style={{ gap: space.xs }}>
              <Row label={CATEGORY_LABELS[entry.category]} value={pluralize(entry.count, "piece")} />
              <View style={{ height: 4, borderRadius: radius.sm, backgroundColor: colours.border }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: radius.sm,
                    width: `${(entry.count / largest) * 100}%`,
                    backgroundColor: colours.primary,
                  }}
                />
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="What you reach for">
        <Card>
          {mostWorn.map((piece) => (
            <Row key={piece.id} label={piece.name} value={pluralize(piece.wearCount, "wear")} />
          ))}
        </Card>
      </Section>

      <Section title="Sitting unworn">
        <Card>
          <Text variant="bodySmall" tone="muted">
            {unworn.length === 0
              ? "Everything in your wardrobe has been worn at least once."
              : `${pluralize(unworn.length, "piece")} has never been worn. Ask the concierge to build a look around one.`}
          </Text>
        </Card>
      </Section>

      <Section title="Recently worn">
        <Card>
          <Row label="Logged wears" value={pluralize(wears.length, "entry", "entries")} />
          <Text variant="bodySmall" tone="muted">
            Track a look with a mirror selfie and it lands here, next to the preview you made before you bought it.
          </Text>
        </Card>
      </Section>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colours = useColours();
  return (
    <View
      style={{
        flex: 1,
        padding: space.lg,
        gap: space.xs,
        borderWidth: 1,
        borderColor: colours.border,
        borderRadius: radius.lg,
      }}
    >
      <Text variant="heading">{value}</Text>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
    </View>
  );
}
