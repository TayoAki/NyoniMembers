import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { lookById, pieceById, wears } from "@/lib/fixtures";
import { relativeDate, shortDate, weekday } from "@/lib/format";
import { radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

/** Free at every tier, as it is at Indyx: planning what you wear is the wardrobe doing its job. */
export default function Calendar() {
  const router = useRouter();
  // Read once per mount: "today" must not move under the member while the screen is open.
  const [now] = useState(() => Date.now());
  const sorted = [...wears].sort((a, b) => b.wornOn - a.wornOn);
  const planned = sorted.filter((wear) => wear.wornOn > now);
  const logged = sorted.filter((wear) => wear.wornOn <= now);

  return (
    <Screen footer={<Button label="Log what you wore today" onPress={() => router.push("/wardrobe")} />}>
      <PageHeading
        eyebrow="Plan and track"
        title="Your calendar"
        subtitle="What you wore, and what you have decided on already."
      />

      <Section title="Planned">
        {planned.length === 0 ? (
          <EmptyState
            title="Nothing planned"
            description="Decide tonight's look now and it will be waiting for you."
            actionLabel="Build a look"
            onAction={() => router.push("/looks/new")}
          />
        ) : (
          <View style={{ gap: space.x3 }}>
            {planned.map((wear) => (
              <WearRow key={wear.id} wear={wear} />
            ))}
          </View>
        )}
      </Section>

      <Section title="Worn" major>
        {logged.length === 0 ? (
          <EmptyState title="Nothing logged yet" description="Mark a look as worn and it lands here." />
        ) : (
          <View style={{ gap: space.x3 }}>
            {logged.map((wear) => (
              <WearRow key={wear.id} wear={wear} />
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

function WearRow({ wear }: { wear: (typeof wears)[number] }) {
  const surface = useSurface();
  const look = wear.lookId ? lookById(wear.lookId) : undefined;
  const names = wear.pieceIds.map((id) => pieceById(id)?.name).filter(Boolean);

  return (
    <OutlinePanel>
      <View style={{ flexDirection: "row", gap: space.x4, alignItems: "center" }}>
        <View
          style={{
            width: 56,
            paddingVertical: space.x2,
            alignItems: "center",
            borderRadius: radius.sm,
            backgroundColor: surface.well,
          }}
        >
          <Text variant="eyebrow" tone="muted">
            {weekday(wear.wornOn)}
          </Text>
          <Text variant="section">{shortDate(wear.wornOn).split(" ")[1]}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="productTitle">{look?.title ?? names.join(" and ") ?? "A look"}</Text>
          <Text variant="eyebrow" tone="muted">
            {relativeDate(wear.wornOn)}
          </Text>
        </View>
      </View>
    </OutlinePanel>
  );
}
