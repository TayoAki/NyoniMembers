import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { EditorialCard } from "@/components/ui/editorial";
import { gridItem, ProductCard, ProductGrid } from "@/components/ui/product";
import { OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { dropById, productById } from "@/lib/fixtures";
import { longDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { TIER_LABELS, TIER_RANK } from "@/lib/types";

/** The edit: a story, then the pieces. A tier-gated edit shows the story and holds back the pieces. */
export default function DropDetail() {
  const { dropId } = useLocalSearchParams<{ dropId: string }>();
  const router = useRouter();
  const { tier } = useSession();
  const drop = dropById(dropId);

  if (!drop) {
    return (
      <Screen>
        <EmptyState
          title="That edit has closed"
          description="The house moves on quickly. Have a look at what is open now."
          actionLabel="Back to drops"
          onAction={() => router.replace("/drops")}
        />
      </Screen>
    );
  }

  const early = TIER_RANK[tier] < TIER_RANK[drop.minTier];

  return (
    <Screen>
      <EditorialCard
        productId={drop.heroPieceId}
        title={drop.title}
        actionLabel={drop.state === "coming" ? "Coming soon" : "The edit"}
        onPress={() => {}}
      />

      <PageHeading
        eyebrow={drop.state === "coming" && drop.opensAt ? `Opens ${longDate(drop.opensAt)}` : "Available now"}
        title={drop.title}
        subtitle={drop.story}
      />

      {early ? (
        <Section>
          <OutlinePanel>
            <Text variant="eyebrow" tone="accent">
              {TIER_LABELS[drop.minTier]} and above
            </Text>
            <Text variant="section">This edit opens to {TIER_LABELS[drop.minTier]} members first.</Text>
            <Text variant="body" tone="muted">
              Your clothier can hold a size before it opens to the house, or talk through whether moving up a tier is
              worth it for how you actually dress.
            </Text>
            <Button
              label="Speak to your clothier"
              variant="secondary"
              onPress={() => router.push("/circle/clothier")}
            />
          </OutlinePanel>
        </Section>
      ) : (
        <Section title="The pieces">
          <ProductGrid>
            {drop.productIds.map((id) => {
              const product = productById(id);
              return product ? <ProductCard key={id} product={product} memberAccess style={gridItem} /> : null;
            })}
          </ProductGrid>
        </Section>
      )}
    </Screen>
  );
}
