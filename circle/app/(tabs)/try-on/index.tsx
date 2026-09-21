import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { LockedBlock } from "@/components/ui/locked-block";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { looks, previews } from "@/lib/fixtures";
import { pluralize, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

/**
 * The fitting room. Atelier gates it, so a free member past their preview sees what it costs rather
 * than an error. The appearance-versus-fit line is on the screen every single time.
 */
export default function TryOn() {
  const router = useRouter();
  const { hasAtelier, atelierSource, previewDaysLeft, previewsUsed, previewsIncluded } = useSession();
  const ready = previews.filter((preview) => preview.status === "ready");

  return (
    <Screen>
      <ScreenHeader
        eyebrow="The fitting room"
        title="See it on you"
        description="A preview shows how a look reads. Your clothier confirms the fit."
      />

      {!hasAtelier ? (
        <LockedBlock
          title="Previews are part of Atelier"
          description="Put any look on your own photo before you commit to it, and keep every preview you make."
        />
      ) : (
        <>
          <Card>
            <Row
              label={atelierSource === "preview" ? "Atelier preview" : "Previews this month"}
              value={
                atelierSource === "preview"
                  ? `${pluralize(previewDaysLeft, "day")} left`
                  : `${previewsUsed} of ${previewsIncluded} used`
              }
            />
            <Button label="Start a new preview" onPress={() => router.push("/looks/new")} />
          </Card>

          <Section title="Your looks">
            <View style={{ gap: space.md }}>
              {looks.map((look) => (
                <Pressable
                  key={look.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview the look, ${look.title}`}
                  onPress={() => router.push({ pathname: "/looks/[lookId]", params: { lookId: look.id } })}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <Card>
                    <Text variant="eyebrow" tone="muted">
                      {look.occasion ?? "A look"}
                    </Text>
                    <Text variant="subheading">{look.title}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          </Section>
        </>
      )}

      <Section title="Previously">
        {ready.length === 0 ? (
          <EmptyBlock
            title="No previews yet"
            description="Build a look, then see it on your own photo before you decide."
            actionLabel="Build a look"
            onAction={() => router.push("/looks/new")}
          />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {ready.map((preview) => (
              <Pressable
                key={preview.id}
                accessibilityRole="button"
                accessibilityLabel={`Open the preview from ${relativeDate(preview.createdAt)}`}
                onPress={() => router.push({ pathname: "/try-on/[previewId]", params: { previewId: preview.id } })}
                style={({ pressed }) => ({ width: "47%", flexGrow: 1, gap: space.sm, opacity: pressed ? 0.85 : 1 })}
              >
                <Photo productId={preview.posterPieceId} fallbackLabel="Preview" />
                <Text variant="eyebrow" tone="muted">
                  {relativeDate(preview.createdAt)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}
