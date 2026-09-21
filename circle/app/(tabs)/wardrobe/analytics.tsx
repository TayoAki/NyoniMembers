import { useRouter } from "expo-router";
import { View } from "react-native";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { LockedState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { atelier, pieces, wears } from "@/lib/fixtures";
import { money, pluralize } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { useSurface } from "@/lib/use-theme";

/** Atelier's dashboard. Every number is derived from the wardrobe, never invented. */
export default function Analytics() {
  const router = useRouter();
  const surface = useSurface();
  const { hasAtelier } = useSession();

  if (!hasAtelier) {
    return (
      <Screen>
        <PageHeading eyebrow="Atelier" title="Your wardrobe, measured" />
        <LockedState
          title="Wardrobe analytics"
          description="What you actually reach for, what each piece costs you per wear, and where the gaps are."
          priceLine={`${money(atelier.annualUsd)} a year. Included with Signature membership and above.`}
          actionLabel="See what Atelier includes"
          onAction={() => router.push("/atelier")}
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
      <PageHeading eyebrow="Atelier" title="Your wardrobe" subtitle="What you own, and what you actually wear." />

      <View style={{ flexDirection: "row", gap: space.x3 }}>
        <Stat label="Pieces" value={String(pieces.length)} />
        <Stat label="Wears logged" value={String(totalWorn)} />
        <Stat label="Invested" value={money(invested)} />
      </View>

      <Section title="What it is made of">
        <OutlinePanel>
          {byCategory.map((entry) => (
            <View key={entry.category} style={{ gap: space.x1 }}>
              <DetailRow label={CATEGORY_LABELS[entry.category]} value={pluralize(entry.count, "piece")} />
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ height: 4, borderRadius: 2, backgroundColor: surface.line }}
              >
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${(entry.count / largest) * 100}%`,
                    backgroundColor: surface.accentText,
                  }}
                />
              </View>
            </View>
          ))}
        </OutlinePanel>
      </Section>

      <Section title="What you reach for">
        <OutlinePanel>
          {mostWorn.map((piece) => (
            <DetailRow key={piece.id} label={piece.name} value={pluralize(piece.wearCount, "wear")} />
          ))}
        </OutlinePanel>
      </Section>

      <Section title="Sitting unworn">
        <Text variant="body" tone="muted">
          {unworn.length === 0
            ? "Everything in your wardrobe has been worn at least once."
            : `${pluralize(unworn.length, "piece")} has never been worn. Ask the stylist to build a look around one.`}
        </Text>
      </Section>

      <Section title="Recently worn">
        <Text variant="body" tone="muted">
          {pluralize(wears.length, "entry", "entries")} logged. Track a look with a mirror selfie and it lands here,
          next to the preview you made before you bought it.
        </Text>
      </Section>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const surface = useSurface();
  return (
    <View
      style={{
        flex: 1,
        padding: space.x4,
        gap: space.x1,
        borderRadius: radius.card,
        backgroundColor: surface.well,
      }}
    >
      <Text variant="section">{value}</Text>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
    </View>
  );
}
