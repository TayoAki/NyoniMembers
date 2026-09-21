import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { pieces } from "@/lib/fixtures";
import { radius, space } from "@/lib/theme";
import { SLOTS, SLOT_CATEGORIES, SLOT_LABELS, type Slot } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

/**
 * A look is built slot by slot, and the rules are the house's: a suit occupies the suit slot, sits
 * over a top and under outerwear, and cannot share the board with separate trousers.
 */
export default function NewLook() {
  const router = useRouter();
  const colours = useColours();
  const [slots, setSlots] = useState<Partial<Record<Slot, string>>>({});
  const [open, setOpen] = useState<Slot | null>("suit");

  const hasSuit = Boolean(slots.suit);
  const conflict = hasSuit && Boolean(slots.bottom);
  const filled = Object.values(slots).filter(Boolean).length;

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {conflict ? (
            <Text variant="bodySmall" tone="warning" center>
              A suit already includes its trousers. Remove one or the other.
            </Text>
          ) : null}
          <Button
            label="Save this look"
            size="lg"
            disabled={filled < 2 || conflict}
            onPress={() => router.replace("/wardrobe")}
          />
        </View>
      }
    >
      <ScreenHeader eyebrow="The outfit studio" title="Build a look" description="A look starts with one piece." />

      <View style={{ gap: space.md }}>
        {SLOTS.map((slot) => {
          const chosenId = slots[slot];
          const chosen = pieces.find((piece) => piece.id === chosenId);
          const disabled = (slot === "bottom" && hasSuit) || (slot === "suit" && Boolean(slots.bottom));
          return (
            <View key={slot} style={{ gap: space.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open === slot, disabled }}
                accessibilityLabel={`${SLOT_LABELS[slot]}${chosen ? `, ${chosen.name}` : ", empty"}`}
                disabled={disabled}
                onPress={() => setOpen(open === slot ? null : slot)}
                style={{
                  minHeight: 64,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  padding: space.md,
                  borderWidth: 1,
                  borderColor: chosen ? colours.primary : colours.border,
                  borderRadius: radius.lg,
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {chosen ? (
                  <Photo productId={chosen.productId} fallbackLabel={chosen.name} style={{ width: 44 }} />
                ) : (
                  <View
                    style={{
                      width: 44,
                      aspectRatio: 4 / 5,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: colours.border,
                    }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="eyebrow" tone="muted">
                    {SLOT_LABELS[slot]}
                  </Text>
                  <Text variant="label" numberOfLines={1}>
                    {chosen?.name ?? (disabled ? "Covered by the suit" : "Choose a piece")}
                  </Text>
                </View>
              </Pressable>

              {open === slot && !disabled ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
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
                        style={{ width: 72, gap: space.xs }}
                      >
                        <Photo productId={piece.productId} fallbackLabel={piece.name} />
                        <Text variant="eyebrow" tone="muted" numberOfLines={1}>
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

      <Section>
        <Text variant="bodySmall" tone="muted">
          Not sure? Tell the concierge the occasion and it will build one from what you own.
        </Text>
        <Button label="Ask the concierge instead" variant="ghost" onPress={() => router.push("/concierge")} />
      </Section>
    </Screen>
  );
}
