import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { appointments, showroomById, suitEntitlement } from "@/lib/fixtures";
import { longDate, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { TIER_CLOTH, TIER_LABELS, TIER_RANK } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

const STAGES = [
  { key: "available", label: "Choose your cloth" },
  { key: "booked", label: "First fitting" },
  { key: "in_progress", label: "In the workroom" },
  { key: "delivered", label: "Delivered" },
] as const;

/** One suit a year is the reason people join. This screen is its whole life, start to finish. */
export default function AnnualSuit() {
  const colours = useColours();
  const router = useRouter();
  const { tier } = useSession();
  const included = TIER_RANK[tier] >= TIER_RANK.signature;
  const appointment = appointments.find((entry) => entry.id === suitEntitlement.appointmentId);
  const reached = STAGES.findIndex((stage) => stage.key === suitEntitlement.status);

  if (!included) {
    return (
      <Screen>
        <ScreenHeader
          eyebrow="The Circle"
          title="A suit each year"
          description="Signature membership and above include one made-to-measure suit a year, cut in Nyoni Fabric."
        />
        <Card>
          <Text variant="bodySmall" tone="muted">
            Membership is arranged by the house rather than in the app. Your clothier will talk you through the tiers
            and what each one is actually worth for how you dress.
          </Text>
          <Button label="Speak to your clothier" onPress={() => router.push("/circle/clothier")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`${suitEntitlement.year} · ${TIER_LABELS[tier]}`}
        title="Your annual suit"
        description={`Cut in ${TIER_CLOTH[tier]}.`}
      />

      <Photo productId="nyoni-grayson" fallbackLabel="Your suit" aspect={3 / 4} contentFit="cover" />

      <Section title="Where it is">
        <Card>
          {STAGES.map((stage, index) => {
            const done = index <= reached;
            return (
              <View key={stage.key} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: radius.pill,
                    backgroundColor: done ? colours.primary : colours.border,
                  }}
                />
                <Text variant="bodySmall" tone={done ? "default" : "muted"}>
                  {stage.label}
                </Text>
              </View>
            );
          })}
        </Card>
      </Section>

      {appointment ? (
        <Section title="Next">
          <Card>
            <Row
              label={`${showroomById(appointment.showroomId)?.city ?? "Showroom"} fitting`}
              value={relativeDate(appointment.requestedFor)}
            />
            <Row label="Date" value={longDate(appointment.requestedFor)} />
            {appointment.note ? (
              <Text variant="bodySmall" tone="muted">
                {appointment.note}
              </Text>
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section>
        <Button
          label={appointment ? "Change this appointment" : "Book your fitting"}
          onPress={() => router.push("/circle/appointments")}
        />
        <Button label="Ask about cloth" variant="secondary" onPress={() => router.push("/circle/clothier")} />
      </Section>

      <Section>
        <Text variant="bodySmall" tone="muted">
          One suit a year, and it does not roll over. Your clothier will remind you well before the year is out.
        </Text>
      </Section>
    </Screen>
  );
}
