import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { Screen } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { lookById, lookPieceIds, pieceById, previewById, productById } from "@/lib/fixtures";
import { longDate } from "@/lib/format";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/** A finished preview: the toggle, the honest caveat, and the two things worth doing next. */
export default function PreviewDetail() {
  const { previewId } = useLocalSearchParams<{ previewId: string }>();
  const router = useRouter();
  const colours = useColours();
  const [showing, setShowing] = useState<"preview" | "original">("preview");
  const preview = previewById(previewId);
  const look = preview?.lookId ? lookById(preview.lookId) : undefined;

  if (!preview) {
    return (
      <Screen>
        <EmptyBlock
          title="That preview is gone"
          description="It may have been removed from your fitting room."
          actionLabel="Back to try-on"
          onAction={() => router.replace("/try-on")}
        />
      </Screen>
    );
  }

  const pieces = look
    ? lookPieceIds(look)
        .map((id) => pieceById(id))
        .filter(Boolean)
    : [];

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button label="Book a fitting" size="lg" onPress={() => router.push("/circle/appointments")} />
          <Text variant="bodySmall" tone="muted" center>
            This is how the look reads. Your clothier confirms the fit.
          </Text>
        </View>
      }
    >
      <View style={{ paddingTop: space.lg }}>
        <Photo productId={preview.posterPieceId} fallbackLabel="Preview" aspect={3 / 4} contentFit="contain" />
      </View>

      <View style={{ alignItems: "center", paddingTop: space.md }}>
        <Text variant="eyebrow" tone="muted">
          Illustrative preview
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignSelf: "center",
          marginTop: space.md,
          padding: 4,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colours.border,
        }}
      >
        {(["original", "preview"] as const).map((mode) => {
          const active = showing === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setShowing(mode)}
              style={{
                minHeight: 40,
                minWidth: 108,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.pill,
                backgroundColor: active ? colours.foreground : "transparent",
              }}
            >
              <Text variant="label" tone={active ? "onPrimary" : "muted"}>
                {mode === "original" ? "Original" : "Preview"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Section title={look?.title ?? "This look"} eyebrow={longDate(preview.createdAt)}>
        <View style={{ gap: space.sm }}>
          {pieces.map((piece) =>
            piece ? (
              <Pressable
                key={piece.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${piece.name}`}
                onPress={() =>
                  piece.productId
                    ? router.push({ pathname: "/product/[productId]", params: { productId: piece.productId } })
                    : router.push({ pathname: "/wardrobe/[pieceId]", params: { pieceId: piece.id } })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Photo productId={piece.productId} fallbackLabel={piece.name} style={{ width: 56 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{piece.name}</Text>
                  <Text variant="eyebrow" tone="muted">
                    {piece.productId ? "Shop this piece" : "Your own"}
                  </Text>
                </View>
              </Pressable>
            ) : null,
          )}
        </View>
      </Section>

      <Section>
        <Button label="Save to your lookbook" variant="secondary" onPress={() => router.back()} />
        <Button label="Share this look" variant="ghost" onPress={() => router.back()} />
      </Section>
    </Screen>
  );
}
