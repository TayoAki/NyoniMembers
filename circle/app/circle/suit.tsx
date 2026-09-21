import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { appointments, showroomById, suitEntitlement } from "@/lib/fixtures";
import { longDate, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { ny, radius, space } from "@/lib/theme";
import { TIER_CLOTH, TIER_LABELS } from "@/lib/types";

const STAGES = [
  { key: "available", label: "Choose your cloth" },
  { key: "booked", label: "First fitting" },
  { key: "in_progress", label: "In the workroom" },
  { key: "delivered", label: "Delivered" },
] as const;

/** One suit a year is the reason people join. This page is its whole life, start to finish. */
export default function AnnualSuit() {
  const router = useRouter();
  const { tier, atLeast } = useSession();
  const appointment = appointments.find((entry) => entry.id === suitEntitlement.appointmentId);
  const reached = STAGES.findIndex((stage) => stage.key === suitEntitlement.status);

  if (!atLeast("signature")) {
    return (
      <Screen tone="dark">
        <PageHeading
          eyebrow="The Circle"
          title="A suit each year"
          subtitle="Signature membership and above include one made-to-measure suit a year, cut in Nyoni Fabric."
        />
        <OutlinePanel>
          <Text variant="body" tone="muted">
            Membership is arranged by the house rather than in the app. Your clothier will talk you through the tiers
            and what each one is actually worth for how you dress.
          </Text>
          <Button label="Speak to your clothier" variant="ivory" onPress={() => router.push("/circle/clothier")} />
        </OutlinePanel>
      </Screen>
    );
  }

  return (
    <Screen tone="dark">
      <PageHeading
        eyebrow={`${suitEntitlement.year} · ${TIER_LABELS[tier]}`}
        title="Your annual suit"
        subtitle={`Cut in ${TIER_CLOTH[tier]}.`}
      />

      <ImageWell productId="nyoni-grayson" label="Your suit" aspect={16 / 9} />

      <Section title="Where it is">
        <OutlinePanel>
          {STAGES.map((stage, index) => {
            const done = index <= reached;
            return (
              <View key={stage.key} style={{ flexDirection: "row", alignItems: "center", gap: space.x3 }}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: radius.pill,
                    backgroundColor: done ? ny.gold : ny.darkLine,
                  }}
                />
                <Text variant="body" tone={done ? "default" : "muted"}>
                  {stage.label}
                  {done ? "" : " · to come"}
                </Text>
              </View>
            );
          })}
        </OutlinePanel>
      </Section>

      {appointment ? (
        <Section title="Next">
          <OutlinePanel>
            <DetailRow
              label={`${showroomById(appointment.showroomId)?.city ?? "Showroom"} fitting`}
              value={relativeDate(appointment.requestedFor)}
            />
            <DetailRow label="Date" value={longDate(appointment.requestedFor)} />
            {appointment.note ? (
              <Text variant="caption" tone="muted">
                {appointment.note}
              </Text>
            ) : null}
          </OutlinePanel>
        </Section>
      ) : null}

      <Section>
        <Button
          label={appointment ? "Change this appointment" : "Book your fitting"}
          variant="ivory"
          onPress={() => router.push("/circle/appointments")}
        />
        <Button label="Ask about cloth" variant="secondary" onPress={() => router.push("/circle/clothier")} />
      </Section>

      <Section>
        <Text variant="caption" tone="muted">
          One suit a year, and it does not roll over. Your clothier will remind you well before the year is out.
        </Text>
      </Section>
    </Screen>
  );
}
