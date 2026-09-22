import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { gridItem, ImageWell, ProductGrid } from "@/components/ui/product";
import { OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState, LockedState } from "@/components/ui/states";
import { ContentTabs, FilterChips } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { atelier, bag, looks, pieces, productById } from "@/lib/fixtures";
import { money, pluralize, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";

type Tab = "owned" | "looks" | "shop";

/**
 * Owned pieces and things saved to buy are separate states, always. A piece does not become owned
 * because it was viewed, tried on or saved.
 */
export default function Wardrobe() {
  const router = useRouter();
  const { hasAtelier } = useSession();
  const [tab, setTab] = useState<Tab>("owned");
  const [category, setCategory] = useState<Category | "all">("all");

  const owned = category === "all" ? pieces : pieces.filter((piece) => piece.category === category);
  const saved = bag.map((line) => productById(line.productId)).filter(Boolean);

  return (
    <Screen
      footer={
        tab === "owned" ? <Button label="Style my wardrobe" onPress={() => router.push("/stylist")} /> : undefined
      }
    >
      <PageHeading
        title="Your wardrobe"
        subtitle="Collected with intention."
        action={<TextAction label="Add a piece" arrow={false} onPress={() => router.push("/wardrobe/add")} />}
      />

      <ContentTabs
        label="Wardrobe views"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "owned", label: "Owned" },
          { value: "looks", label: "Saved looks" },
          { value: "shop", label: "Saved to shop" },
        ]}
      />

      {tab === "owned" ? (
        <>
          <Section>
            <FilterChips
              label="Filter by category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all" as const, label: "Everything" },
                ...CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
              ]}
            />
          </Section>

          {owned.length === 0 ? (
            <Section>
              <EmptyState
                title="Nothing here yet"
                description="Photograph a garment you already own, or shop the house."
                actionLabel="Add a piece"
                onAction={() => router.push("/wardrobe/add")}
              />
            </Section>
          ) : (
            <Section>
              <ProductGrid>
                {owned.map((piece) => (
                  <Link
                    key={piece.id}
                    href={{ pathname: "/wardrobe/[pieceId]", params: { pieceId: piece.id } }}
                    asChild
                  >
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`${piece.name}, ${piece.source === "owned" ? "your own" : "from the house"}`}
                      style={({ pressed }) => [gridItem, { gap: space.x2, opacity: pressed ? 0.86 : 1 }]}
                    >
                      <ImageWell productId={piece.productId} label={piece.name} isolated />
                      <View style={{ gap: 2 }}>
                        <Text variant="productTitle" numberOfLines={2}>
                          {piece.name}
                        </Text>
                        <Text variant="eyebrow" tone="muted">
                          {piece.source === "owned" ? "You own" : "Nyoni"}
                        </Text>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </ProductGrid>
            </Section>
          )}

          <Section title="How you are wearing it" major>
            {hasAtelier ? (
              <>
                <Text variant="body" tone="muted">
                  {pluralize(pieces.length, "piece")} in the wardrobe. Your analytics show what you reach for and what
                  each piece costs you per wear.
                </Text>
                <Button
                  label="Open your analytics"
                  variant="secondary"
                  onPress={() => router.push("/wardrobe/analytics")}
                />
              </>
            ) : (
              <LockedState
                compact
                title="Wardrobe analytics"
                description="What you actually wear, what each piece costs per wear, and where the gaps are."
                priceLine={`${money(atelier.annualUsd)} a year. Included with Signature membership and above.`}
                actionLabel="See what Atelier includes"
                onAction={() => router.push("/atelier")}
              />
            )}
          </Section>
        </>
      ) : null}

      {tab === "looks" ? (
        <Section>
          {looks.length === 0 ? (
            <EmptyState
              title="Your next look starts here."
              description="Build one from what you own, or ask the stylist."
              actionLabel="Build a look"
              onAction={() => router.push("/looks/new")}
            />
          ) : (
            <View style={{ gap: space.x3 }}>
              {looks.map((look) => (
                <OutlinePanel key={look.id}>
                  <Text variant="eyebrow" tone="muted">
                    {look.occasion ?? "A look"} · saved {relativeDate(look.createdAt)}
                  </Text>
                  <Text variant="section">{look.title}</Text>
                  {look.source === "stylist" ? (
                    <Text variant="eyebrow" tone="accent">
                      Styled for you
                    </Text>
                  ) : null}
                  <TextAction
                    label="Open this look"
                    onPress={() => router.push({ pathname: "/looks/[lookId]", params: { lookId: look.id } })}
                  />
                </OutlinePanel>
              ))}
            </View>
          )}
        </Section>
      ) : null}

      {tab === "shop" ? (
        <Section>
          {saved.length === 0 ? (
            <EmptyState
              title="Nothing saved to buy"
              description="Pieces you save from a drop or a look are kept here until you decide."
              actionLabel="See the drops"
              onAction={() => router.push("/drops")}
            />
          ) : (
            <>
              <Text variant="body" tone="muted">
                Saved to buy. Nothing here is yours until an order is placed.
              </Text>
              <ProductGrid>
                {saved.map((product) =>
                  product ? (
                    <View key={product.id} style={[gridItem, { gap: space.x2 }]}>
                      <ImageWell productId={product.id} label={product.name} isolated />
                      <Text variant="productTitle" numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {money(product.priceUsd)}
                      </Text>
                    </View>
                  ) : null,
                )}
              </ProductGrid>
              <Button label="Open your bag" variant="secondary" onPress={() => router.push("/bag")} />
            </>
          )}
        </Section>
      ) : null}
    </Screen>
  );
}
