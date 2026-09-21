import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { ConciergeCard } from "@/components/circle/concierge-card";
import { MembershipCard } from "@/components/circle/membership-card";
import { ImageWell } from "@/components/ui/product";
import { DetailRow, OutlinePanel, ServiceRow } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { member, suitEntitlement } from "@/lib/fixtures";
import { longDate, money } from "@/lib/format";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { TIER_BENEFITS, TIER_CLOTH, TIER_LABELS, TIER_PRICE_USD } from "@/lib/types";

const SUIT_STATUS: Record<string, string> = {
  available: "Ready to begin",
  booked: "Fitting booked",
  in_progress: "In the workroom",
  delivered: "Delivered",
};

/** The one dark page. Membership opens from the header, so no bottom destination is selected here. */
export default function Circle() {
  const router = useRouter();
  const { tier, atelierSource, previewsUsed, previewsIncluded, hasAtelier, atLeast } = useSession();

  return (
    <Screen tone="dark">
      <PageHeading title="Your place in the Circle." />

      <MembershipCard tier={TIER_LABELS[tier]} status="Private member" />

      {atLeast("signature") ? (
        <Section title="Your annual suit">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.x2 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#D6B675" }}
            />
            <Text variant="body">{SUIT_STATUS[suitEntitlement.status] ?? "Ready to begin"}</Text>
          </View>
          <Text variant="caption" tone="muted">
            Cut in {TIER_CLOTH[tier]}.
          </Text>
          <ImageWell productId="nyoni-grayson" label="Your cloth" aspect={16 / 7} />
          <Button label="Book your fitting" variant="ivory" onPress={() => router.push("/circle/suit")} />
        </Section>
      ) : null}

      <Section title="Your membership">
        <OutlinePanel>
          <DetailRow label="Tier" value={TIER_LABELS[tier]} />
          <DetailRow label="Cloth grade" value={TIER_CLOTH[tier]} />
          <DetailRow
            label="Annual"
            value={TIER_PRICE_USD[tier] > 0 ? `${money(TIER_PRICE_USD[tier])} a year` : "No fee"}
          />
          <DetailRow label="Member since" value={longDate(member.memberSince)} />
          <DetailRow
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
          {hasAtelier ? <DetailRow label="Previews" value={`${previewsUsed} of ${previewsIncluded}`} /> : null}
        </OutlinePanel>
      </Section>

      <Section title="Your privileges">
        <OutlinePanel>
          {TIER_BENEFITS[tier].map((benefit) => (
            <Text key={benefit} variant="body">
              · {benefit}
            </Text>
          ))}
        </OutlinePanel>
      </Section>

      <Section>
        <ServiceRow label="Appointments" onPress={() => router.push("/circle/appointments")} />
        <ServiceRow label="Orders" onPress={() => router.push("/orders")} />
        <ServiceRow label="Manage membership" onPress={() => router.push("/settings")} />
      </Section>

      {!hasAtelier ? (
        <Section>
          <Button label="See what Atelier includes" variant="ivory" onPress={() => router.push("/atelier")} />
        </Section>
      ) : null}

      <Section title="Your clothier" major>
        <ConciergeCard
          name="The Nyoni house"
          blurb="Your clothier is one conversation away, for a fitting, an alteration or a commission."
          onContact={() => router.push("/circle/clothier")}
        />
        <Text variant="caption" tone="muted">
          Membership is arranged by the house, not in the app. Your clothier can change your tier or arrange a gift
          membership.
        </Text>
      </Section>
    </Screen>
  );
}
