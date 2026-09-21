import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { InlineNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { pieces } from "@/lib/fixtures";
import { radius, space } from "@/lib/theme";
import { SLOT_CATEGORIES, SLOT_LABELS, SLOTS, type Slot } from "@/lib/types";
import { useSurface } from "@/lib/use-theme";

/**
 * A look is built slot by slot, under the house's rules: a suit occupies the suit slot, sits over a
 * top and under outerwear, and cannot share the board with separate trousers.
 */
export default function NewLook() {
  const router = useRouter();
  const surface = useSurface();
  const [slots, setSlots] = useState<Partial<Record<Slot, string>>>({});
  const [open, setOpen] = useState<Slot | null>("suit");

  const hasSuit = Boolean(slots.suit);
  const conflict = hasSuit && Boolean(slots.bottom);
  const filled = Object.values(slots).filter(Boolean).length;

  return (
    <Screen
      footer={
        <View style={{ gap: space.x2 }}>
          {conflict ? (
            <Text variant="caption" tone="error" center>
              A suit already includes its trousers. Remove one or the other.
            </Text>
          ) : null}
          <Button
            label="Save this look"
            disabled={filled < 2 || conflict}
            onPress={() => router.replace("/wardrobe")}
          />
        </View>
      }
    >
      <PageHeading eyebrow="The outfit studio" title="Build a look" subtitle="A look starts with one piece." />

      <View style={{ gap: space.x3 }}>
        {SLOTS.map((slot) => {
          const chosen = pieces.find((piece) => piece.id === slots[slot]);
          const disabled = (slot === "bottom" && hasSuit) || (slot === "suit" && Boolean(slots.bottom));
          return (
            <View key={slot} style={{ gap: space.x2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open === slot, disabled }}
                accessibilityLabel={`${SLOT_LABELS[slot]}${chosen ? `, ${chosen.name}` : ", empty"}`}
                disabled={disabled}
                onPress={() => setOpen(open === slot ? null : slot)}
                style={{
                  minHeight: 68,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.x3,
                  padding: space.x3,
                  borderWidth: 1,
                  borderColor: chosen ? surface.text : surface.controlLine,
                  borderRadius: radius.card,
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <ImageWell productId={chosen?.productId} label={chosen?.name ?? ""} isolated style={{ width: 44 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="eyebrow" tone="muted">
                    {SLOT_LABELS[slot]}
                  </Text>
                  <Text variant="productTitle" numberOfLines={1}>
                    {chosen?.name ?? (disabled ? "Covered by the suit" : "Choose a piece")}
                  </Text>
                </View>
              </Pressable>

              {open === slot && !disabled ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x2 }}>
                  {pieces
                    .filter((piece) => SLOT_CATEGORIES[slot].includes(piece.category))
                    .map((piece) => (
                      <Pressable
                        key={piece.id}
                        accessibilityRole="button"
                        accessibilityLabel={piece.name}
                        onPress={() => {
                          setSlots((prior) => ({ ...prior, [slot]: prior[slot] === piece.id ? undefined : piece.id }));
                          setOpen(null);
                        }}
                        style={{ width: 76, gap: space.x1 }}
                      >
                        <ImageWell productId={piece.productId} label={piece.name} isolated />
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {piece.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {filled === 0 ? (
        <Section>
          <InlineNotice
            title="Not sure where to start?"
            description="Tell the stylist the occasion and it will build a look from what you own."
            actionLabel="Ask the stylist"
            onAction={() => router.push("/stylist")}
          />
        </Section>
      ) : (
        <Section>
          <TextAction label="Ask the stylist instead" onPress={() => router.push("/stylist")} />
        </Section>
      )}
    </Screen>
  );
}
