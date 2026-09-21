import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, PieceCard } from "@/components/ui/cards";
import { LockedBlock } from "@/components/ui/locked-block";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { boards, looks, pieces, productById } from "@/lib/fixtures";
import { pluralize, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

type Tab = "owned" | "looks" | "boards";

/** Three views of the same wardrobe: what you have, what you have built, what you are saving for. */
export default function Wardrobe() {
  const router = useRouter();
  const colours = useColours();
  const { hasAtelier } = useSession();
  const [tab, setTab] = useState<Tab>("owned");
  const [category, setCategory] = useState<Category | "all">("all");

  const shown = category === "all" ? pieces : pieces.filter((piece) => piece.category === category);

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Collected with intention"
        title="Your wardrobe"
        description={`${pluralize(pieces.length, "piece")}, including the Nyoni capsule.`}
        action={<Button label="Add" full={false} onPress={() => router.push("/wardrobe/add")} />}
      />

      <View style={{ flexDirection: "row", gap: space.xl, paddingBottom: space.lg }}>
        {(
          [
            ["owned", "Owned"],
            ["looks", "Saved looks"],
            ["boards", "Boards"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              borderBottomWidth: 2,
              borderBottomColor: tab === key ? colours.primary : "transparent",
            }}
          >
            <Text variant="label" tone={tab === key ? "default" : "muted"}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "owned" ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingBottom: space.lg }}>
            {(["all", ...CATEGORIES] as const).map((value) => {
              const active = category === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCategory(value)}
                  style={{
                    minHeight: 36,
                    justifyContent: "center",
                    paddingHorizontal: space.md,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colours.primary : colours.border,
                  }}
                >
                  <Text variant="eyebrow" tone={active ? "primary" : "muted"}>
                    {value === "all" ? "Everything" : CATEGORY_LABELS[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {shown.length === 0 ? (
            <EmptyBlock
              title="Nothing in this category yet"
              description="Photograph a garment you own, or shop the house."
              actionLabel="Add a piece"
              onAction={() => router.push("/wardrobe/add")}
            />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              {shown.map((piece) => (
                <PieceCard key={piece.id} piece={piece} style={{ width: "47%", flexGrow: 1 }} />
              ))}
            </View>
          )}

          <Section title="How you are wearing it">
            {hasAtelier ? (
              <Card>
                <Text variant="bodySmall" tone="muted">
                  Your analytics show what you actually reach for, what each piece costs you per wear, and where the
                  gaps are.
                </Text>
                <Button
                  label="Open your analytics"
                  variant="secondary"
                  onPress={() => router.push("/wardrobe/analytics")}
                />
              </Card>
            ) : (
              <LockedBlock
                compact
                title="Wardrobe analytics"
                description="See what you actually wear, what each piece costs per wear, and what is missing."
              />
            )}
          </Section>
        </>
      ) : null}

      {tab === "looks" ? (
        <View style={{ gap: space.md }}>
          <Button label="Build a look" onPress={() => router.push("/looks/new")} />
          {looks.map((look) => (
            <Pressable
              key={look.id}
              accessibilityRole="button"
              accessibilityLabel={look.title}
              onPress={() => router.push({ pathname: "/looks/[lookId]", params: { lookId: look.id } })}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Card>
                <Text variant="eyebrow" tone="muted">
                  {look.occasion ?? "A look"} · saved {relativeDate(look.createdAt)}
                </Text>
                <Text variant="subheading">{look.title}</Text>
                {look.source === "concierge" ? (
                  <Text variant="eyebrow" tone="primary">
                    Styled by the concierge
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === "boards" ? (
        hasAtelier ? (
          <View style={{ gap: space.xl }}>
            {boards.map((board) => (
              <View key={board.id} style={{ gap: space.md }}>
                <Text variant="heading">{board.title}</Text>
                <View style={{ flexDirection: "row", gap: space.md }}>
                  {board.pieceIds.map((id) => {
                    const product = productById(id);
                    return (
                      <View key={id} style={{ flex: 1, gap: space.sm }}>
                        <Photo productId={id} fallbackLabel={product?.name ?? "Piece"} />
                        <Text variant="eyebrow" tone="muted" numberOfLines={1}>
                          {product?.name ?? ""}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <LockedBlock
            title="Inspiration boards"
            description="Keep the references that shape what you commission next, alongside the pieces you already own."
          />
        )
      ) : null}
    </Screen>
  );
}
