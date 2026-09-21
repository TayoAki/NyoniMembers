import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { lookById, pieceById, wears } from "@/lib/fixtures";
import { relativeDate, shortDate, weekday } from "@/lib/format";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/** Free at every tier, as it is at Indyx: planning what you wear is the wardrobe working. */
export default function Calendar() {
  const colours = useColours();
  const router = useRouter();

  const sorted = [...wears].sort((a, b) => b.wornOn - a.wornOn);
  const planned = sorted.filter((wear) => wear.wornOn > Date.now());
  const logged = sorted.filter((wear) => wear.wornOn <= Date.now());

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Plan and track"
        title="Your calendar"
        description="What you wore, and what you have decided on already."
      />

      <Section title="Planned">
        {planned.length === 0 ? (
          <EmptyBlock
            title="Nothing planned"
            description="Decide tonight's look now and it will be waiting for you."
            actionLabel="Build a look"
            onAction={() => router.push("/looks/new")}
          />
        ) : (
          planned.map((wear) => <WearRow key={wear.id} wear={wear} />)
        )}
      </Section>

      <Section title="Worn">
        {logged.length === 0 ? (
          <EmptyBlock title="Nothing logged yet" description="Mark a look as worn and it lands here." />
        ) : (
          logged.map((wear) => <WearRow key={wear.id} wear={wear} />)
        )}
      </Section>

      <Section>
        <Button label="Log what you wore today" onPress={() => router.push("/wardrobe")} />
      </Section>
    </Screen>
  );

  function WearRow({ wear }: { wear: (typeof wears)[number] }) {
    const look = wear.lookId ? lookById(wear.lookId) : undefined;
    const names = wear.pieceIds.map((id) => pieceById(id)?.name).filter(Boolean);
    return (
      <Card>
        <View style={{ flexDirection: "row", gap: space.lg, alignItems: "center" }}>
          <View
            style={{
              width: 52,
              paddingVertical: space.sm,
              alignItems: "center",
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colours.border,
            }}
          >
            <Text variant="eyebrow" tone="muted">
              {weekday(wear.wornOn)}
            </Text>
            <Text variant="subheading">{shortDate(wear.wornOn).split(" ")[1]}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{look?.title ?? names.join(" and ") ?? "A look"}</Text>
            <Text variant="eyebrow" tone="muted">
              {relativeDate(wear.wornOn)}
            </Text>
          </View>
        </View>
      </Card>
    );
  }
}
