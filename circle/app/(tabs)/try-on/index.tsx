import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { gridItem, ProductGrid, SelectedGarmentRow } from "@/components/ui/product";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState, InlineNotice, LockedState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { BeforeAfterControl, PreviewStage, type PreviewState } from "@/components/try-on/preview-stage";
import { atelier, lookById, previews, productById } from "@/lib/fixtures";
import { money, pluralize, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

/**
 * The fitting room. Atelier gates it, so a member past their preview is shown the price rather than
 * an error, and the appearance-versus-fit line is on the screen in every state.
 */
export default function FittingRoom() {
  const router = useRouter();
  const { hasAtelier, atelierSource, previewDaysLeft, previewsUsed, previewsIncluded } = useSession();
  const [showing, setShowing] = useState<"original" | "preview">("preview");
  const [state, setState] = useState<PreviewState>("ready");

  const latest = previews[0];
  const look = latest?.lookId ? lookById(latest.lookId) : undefined;

  if (!hasAtelier) {
    return (
      <Screen>
        <PageHeading title="Your fitting room" subtitle="AI visual preview" />
        <LockedState
          title="See a piece on yourself"
          description="Put any look on your own photo before you commit to it, and keep every preview you make."
          priceLine={`${money(atelier.annualUsd)} a year or ${money(atelier.monthlyUsd)} a month. Included with Signature membership and above.`}
          actionLabel="See what Atelier includes"
          onAction={() => router.push("/atelier")}
        />
        <Section>
          <Text variant="body" tone="muted">
            A preview shows how a look reads on you. Your clothier confirms the fit at the showroom, and booking one is
            free at every tier.
          </Text>
          <Button label="Book a fitting" variant="secondary" onPress={() => router.push("/circle/appointments")} />
        </Section>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space.x2 }}>
          <Button label="Shop this piece" onPress={() => router.push("/drops")} />
          <Button label="Save look" variant="secondary" onPress={() => setState("ready")} />
        </View>
      }
    >
      <PageHeading title="Your fitting room" subtitle="AI visual preview" />

      <PreviewStage state={state} productId={latest?.posterPieceId} label={look?.title ?? "this look"} />

      {state === "ready" ? (
        <View style={{ paddingTop: space.x4, gap: space.x4 }}>
          <BeforeAfterControl value={showing} onChange={setShowing} />

          <SelectedGarmentRow
            productId={latest?.posterPieceId}
            name={look?.title ?? "Midnight tuxedo"}
            actionLabel="Change"
            onAction={() => router.push("/looks/new")}
          />

          <Text variant="body" tone="muted">
            Explore the look. Confirm fit with your clothier.
          </Text>
        </View>
      ) : null}

      {state === "failed" ? (
        <View style={{ paddingTop: space.x4 }}>
          <InlineNotice
            tone="error"
            title="The preview did not finish"
            description="Your photo and your look are still here. Try again, or use a different photo."
            actionLabel="Try again"
            onAction={() => setState("generating")}
          />
        </View>
      ) : null}

      <Section title="This month">
        <Text variant="body" tone="muted">
          {atelierSource === "preview"
            ? `Your Atelier preview has ${pluralize(previewDaysLeft, "day")} left.`
            : `${previewsUsed} of ${previewsIncluded} previews used.`}
        </Text>
      </Section>

      <Section title="Previously" major>
        {previews.length === 0 ? (
          <EmptyState
            title="Your next look starts here."
            description="Build a look, then see it on your own photo before you decide."
            actionLabel="Build a look"
            onAction={() => router.push("/looks/new")}
          />
        ) : (
          <ProductGrid>
            {previews.map((preview) => {
              const product = productById(preview.posterPieceId);
              return (
                <View key={preview.id} style={[gridItem, { gap: space.x2 }]}>
                  <PreviewStage state="ready" productId={preview.posterPieceId} label={product?.name ?? "Preview"} />
                  <Text variant="caption" tone="muted">
                    {relativeDate(preview.createdAt)}
                  </Text>
                </View>
              );
            })}
          </ProductGrid>
        )}
      </Section>
    </Screen>
  );
}
