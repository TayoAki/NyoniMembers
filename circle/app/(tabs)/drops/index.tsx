import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Card, ProductCard } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { drops, productById } from "@/lib/fixtures";
import { relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, ratio, space } from "@/lib/theme";
import { TIER_LABELS, TIER_RANK, type Drop } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

/** Drops are merchandising, not a paywall: every signed-in member shops. Tiers only gate early access. */
export default function Drops() {
  const router = useRouter();
  const [tab, setTab] = useState<Drop["state"]>("available");
  const shown = drops.filter((drop) => drop.state === tab);

  return (
    <Screen>
      <ScreenHeader eyebrow="The house" title="Private drops" description="Selected by the house. Reserved for you." />

      <View style={{ flexDirection: "row", gap: space.xl, paddingBottom: space.lg }}>
        {(["available", "coming"] as const).map((state) => (
          <TabButton
            key={state}
            label={state === "available" ? "Available now" : "Coming soon"}
            active={tab === state}
            onPress={() => setTab(state)}
          />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyBlock
          title="Nothing here yet"
          description="When the house opens the next edit, it appears here and you will get a note."
        />
      ) : (
        shown.map((drop) => (
          <DropBlock
            key={drop.id}
            drop={drop}
            onOpen={() => router.push({ pathname: "/drops/[dropId]", params: { dropId: drop.id } })}
          />
        ))
      )}
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colours = useColours();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: "center",
        borderBottomWidth: 2,
        borderBottomColor: active ? colours.primary : "transparent",
      }}
    >
      <Text variant="label" tone={active ? "default" : "muted"}>
        {label}
      </Text>
    </Pressable>
  );
}

function DropBlock({ drop, onOpen }: { drop: Drop; onOpen: () => void }) {
  const colours = useColours();
  const { tier } = useSession();
  const locked = TIER_RANK[tier] < TIER_RANK[drop.minTier];

  return (
    <Section>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${drop.title}`}
        onPress={onOpen}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, gap: space.md })}
      >
        <View>
          <Photo productId={drop.heroPieceId} fallbackLabel={drop.title} aspect={ratio.hero} contentFit="cover" />
          {drop.state === "coming" && drop.opensAt ? (
            <View
              style={{
                position: "absolute",
                top: space.md,
                left: space.md,
                paddingHorizontal: space.md,
                paddingVertical: space.xs,
                borderRadius: radius.pill,
                backgroundColor: colours.background,
              }}
            >
              <Text variant="eyebrow" tone="primary">
                Opens {relativeDate(drop.opensAt)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ gap: space.xs }}>
          <Text variant="heading">{drop.title}</Text>
          <Text variant="bodySmall" tone="muted">
            {drop.subtitle}
          </Text>
          {locked ? (
            <Text variant="eyebrow" tone="primary">
              {TIER_LABELS[drop.minTier]} and above, first
            </Text>
          ) : null}
        </View>
      </Pressable>

      {drop.state === "available" ? (
        <View style={{ flexDirection: "row", gap: space.md }}>
          {drop.productIds.slice(0, 2).map((id) => {
            const product = productById(id);
            return product ? <ProductCard key={id} product={product} style={{ flex: 1 }} /> : null;
          })}
        </View>
      ) : (
        <Card>
          <Text variant="bodySmall" tone="muted">
            {drop.story}
          </Text>
        </Card>
      )}
    </Section>
  );
}
