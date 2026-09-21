import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, ProductCard } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { dropById, productById } from "@/lib/fixtures";
import { longDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { ratio, space } from "@/lib/theme";
import { TIER_LABELS, TIER_RANK } from "@/lib/types";

/** The edit: a story, then the pieces. A tier-gated drop shows the story and withholds the pieces. */
export default function DropDetail() {
  const { dropId } = useLocalSearchParams<{ dropId: string }>();
  const router = useRouter();
  const { tier } = useSession();
  const drop = dropById(dropId);

  if (!drop) {
    return (
      <Screen>
        <EmptyBlock
          title="That edit has closed"
          description="The house moves on quickly. Have a look at what is open now."
          actionLabel="Back to drops"
          onAction={() => router.replace("/drops")}
        />
      </Screen>
    );
  }

  const locked = TIER_RANK[tier] < TIER_RANK[drop.minTier];
  const notYetOpen = drop.state === "coming";

  return (
    <Screen>
      <Photo productId={drop.heroPieceId} fallbackLabel={drop.title} aspect={ratio.hero} contentFit="cover" />

      <View style={{ paddingTop: space.xl, gap: space.md }}>
        <Text variant="eyebrow" tone="primary">
          {notYetOpen && drop.opensAt ? `Opens ${longDate(drop.opensAt)}` : "Available now"}
        </Text>
        <Text variant="title">{drop.title}</Text>
        <Text variant="body" tone="muted">
          {drop.story}
        </Text>
      </View>

      {locked ? (
        <Section>
          <Card>
            <Text variant="eyebrow" tone="primary">
              {TIER_LABELS[drop.minTier]} and above
            </Text>
            <Text variant="subheading">This edit opens to {TIER_LABELS[drop.minTier]} members first.</Text>
            <Text variant="bodySmall" tone="muted">
              Your clothier can hold a size for you before it opens to the house, or talk through whether moving up a
              tier is worth it for how you actually dress.
            </Text>
            <Button
              label="Speak to your clothier"
              variant="secondary"
              onPress={() => router.push("/circle/clothier")}
            />
          </Card>
        </Section>
      ) : (
        <Section title="The pieces">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {drop.productIds.map((id) => {
              const product = productById(id);
              return product ? <ProductCard key={id} product={product} style={{ width: "47%", flexGrow: 1 }} /> : null;
            })}
          </View>
        </Section>
      )}
    </Screen>
  );
}
