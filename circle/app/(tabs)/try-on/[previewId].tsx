import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { BeforeAfterControl, PreviewStage } from "@/components/try-on/preview-stage";
import { lookById, lookPieceIds, pieceById, previewById } from "@/lib/fixtures";
import { longDate } from "@/lib/format";
import { space } from "@/lib/theme";

export default function PreviewDetail() {
  const { previewId } = useLocalSearchParams<{ previewId: string }>();
  const router = useRouter();
  const [showing, setShowing] = useState<"original" | "preview">("preview");
  const preview = previewById(previewId);
  const look = preview?.lookId ? lookById(preview.lookId) : undefined;

  if (!preview) {
    return (
      <Screen>
        <EmptyState
          title="That preview is gone"
          description="It may have been removed from your fitting room."
          actionLabel="Back to the fitting room"
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
        <View style={{ gap: space.x2 }}>
          <Button label="Book a fitting" onPress={() => router.push("/circle/appointments")} />
          <Text variant="caption" tone="muted" center>
            This is how the look reads. Your clothier confirms the fit.
          </Text>
        </View>
      }
    >
      <PageHeading eyebrow={longDate(preview.createdAt)} title={look?.title ?? "Your preview"} />

      <PreviewStage state="ready" productId={preview.posterPieceId} label={look?.title ?? "this look"} />

      <Section>
        <BeforeAfterControl value={showing} onChange={setShowing} />
      </Section>

      <Section title="In this look">
        <View style={{ gap: space.x3 }}>
          {pieces.map((piece) =>
            piece ? (
              <Pressable
                key={piece.id}
                accessibilityRole="link"
                accessibilityLabel={`${piece.name}, ${piece.productId ? "shop this piece" : "your own"}`}
                onPress={() =>
                  piece.productId
                    ? router.push({ pathname: "/product/[productId]", params: { productId: piece.productId } })
                    : router.push({ pathname: "/wardrobe/[pieceId]", params: { pieceId: piece.id } })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.x3,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <ImageWell productId={piece.productId} label={piece.name} isolated style={{ width: 52 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="productTitle">{piece.name}</Text>
                  <Text variant="eyebrow" tone={piece.productId ? "accent" : "muted"}>
                    {piece.productId ? "Nyoni" : "You own"}
                  </Text>
                </View>
              </Pressable>
            ) : null,
          )}
        </View>
      </Section>

      <Section>
        <Button label="Save look" variant="secondary" onPress={() => router.back()} />
      </Section>
    </Screen>
  );
}
