import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { EditorialCard } from "@/components/ui/editorial";
import { gridItem, ProductCard, ProductGrid } from "@/components/ui/product";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { ContentTabs } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { drops, productById } from "@/lib/fixtures";
import { longDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { TIER_LABELS, TIER_RANK, type Drop } from "@/lib/types";

/** Shopping is never gated. Tiers only decide who sees an edit first. */
export default function Drops() {
  const router = useRouter();
  const [state, setState] = useState<Drop["state"]>("available");
  const shown = drops.filter((drop) => drop.state === state);

  return (
    <Screen>
      <PageHeading title="Private drops" subtitle="Selected by the house. Reserved for you." />

      <ContentTabs
        label="Drop availability"
        value={state}
        onChange={setState}
        tabs={[
          { value: "available", label: "Available now" },
          { value: "coming", label: "Coming soon" },
        ]}
      />

      {shown.length === 0 ? (
        <Section>
          <EmptyState
            title="Nothing open just now"
            description="When the house opens the next edit it appears here, and you will get a note."
          />
        </Section>
      ) : (
        shown.map((drop, index) => (
          <DropFeature
            key={drop.id}
            drop={drop}
            major={index > 0}
            onOpen={() => router.push({ pathname: "/drops/[dropId]", params: { dropId: drop.id } })}
          />
        ))
      )}
    </Screen>
  );
}

function DropFeature({ drop, major, onOpen }: { drop: Drop; major: boolean; onOpen: () => void }) {
  const { tier } = useSession();
  const early = TIER_RANK[tier] < TIER_RANK[drop.minTier];

  return (
    <Section major={major}>
      <EditorialCard productId={drop.heroPieceId} title={drop.title} actionLabel="Explore the edit" onPress={onOpen} />

      {drop.state === "coming" ? (
        <View style={{ gap: space.x2 }}>
          <Text variant="body" tone="muted">
            {drop.story}
          </Text>
          <Text variant="eyebrow" tone="accent">
            {drop.opensAt ? `Opens ${longDate(drop.opensAt)}` : "Date to be confirmed"}
            {early ? ` · ${TIER_LABELS[drop.minTier]} and above first` : ""}
          </Text>
        </View>
      ) : (
        <ProductGrid>
          {drop.productIds.slice(0, 4).map((id) => {
            const product = productById(id);
            return product ? <ProductCard key={id} product={product} memberAccess style={gridItem} /> : null;
          })}
        </ProductGrid>
      )}
    </Section>
  );
}
