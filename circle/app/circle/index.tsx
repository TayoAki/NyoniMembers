import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, NavRow, Row } from "@/components/ui/cards";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { Wordmark } from "@/components/ui/wordmark";
import { member } from "@/lib/fixtures";
import { longDate, money, pluralize } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { TIER_BENEFITS, TIER_CLOTH, TIER_LABELS, TIER_PRICE_USD } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

/** The membership card and everything the house does for you rather than the app. */
export default function Circle() {
  const colours = useColours();
  const router = useRouter();
  const { tier, hasAtelier, atelierSource, previewsUsed, previewsIncluded } = useSession();

  return (
    <Screen>
      <View style={{ paddingTop: space.lg, gap: space.md }}>
        <Text variant="title">Your place in the Circle.</Text>
      </View>

      <View
        style={{
          marginTop: space.lg,
          padding: space.xl,
          gap: space.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colours.primary,
          backgroundColor: colours.surface,
          alignItems: "center",
        }}
      >
        <Wordmark size="sm" />
        <Text variant="title" tone="primary" style={{ letterSpacing: 4 }}>
          {TIER_LABELS[tier].toUpperCase()}
        </Text>
        <Text variant="eyebrow" tone="muted">
          Private member
        </Text>
      </View>

      <Section title="Your membership">
        <Card>
          <Row label="Tier" value={TIER_LABELS[tier]} />
          <Row label="Cloth grade" value={TIER_CLOTH[tier]} />
          <Row label="Annual" value={TIER_PRICE_USD[tier] > 0 ? `${money(TIER_PRICE_USD[tier])} a year` : "No fee"} />
          <Row label="Member since" value={longDate(member.memberSince)} />
          <Row
            label="Atelier"
            value={
              atelierSource === "membership"
                ? "Included"
                : atelierSource === "subscription"
                  ? "Subscribed"
                  : atelierSource === "preview"
                    ? "Preview running"
                    : "Not active"
            }
          />
          {hasAtelier ? <Row label="Previews" value={`${previewsUsed} of ${previewsIncluded} this month`} /> : null}
        </Card>
      </Section>

      <Section title="What it includes">
        <Card>
          {TIER_BENEFITS[tier].map((benefit) => (
            <Text key={benefit} variant="bodySmall">
              · {benefit}
            </Text>
          ))}
        </Card>
      </Section>

      <Section>
        <NavRow label="Your annual suit" onPress={() => router.push("/circle/suit")} />
        <NavRow label="Appointments" onPress={() => router.push("/circle/appointments")} />
        <NavRow label="Your clothier" onPress={() => router.push("/circle/clothier")} />
        <NavRow label="Orders" onPress={() => router.push("/orders")} />
        <NavRow label="Settings" onPress={() => router.push("/settings")} />
      </Section>

      {!hasAtelier ? (
        <Section>
          <Button label="See what Atelier includes" variant="secondary" onPress={() => router.push("/atelier")} />
        </Section>
      ) : null}

      <Section>
        <Text variant="bodySmall" tone="muted">
          Membership is arranged by the house, not in the app. Your clothier can change your tier, arrange a gift
          membership, or talk through whether moving up is worth it for how you actually dress.
        </Text>
      </Section>
    </Screen>
  );
}
