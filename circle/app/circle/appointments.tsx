import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { appointments, showroomById, showrooms } from "@/lib/fixtures";
import { longDate, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { APPOINTMENT_LABELS, TIER_RANK, type Appointment } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

/** Booking is free at every tier; only priority differs, and the screen says so rather than hiding it. */
export default function Appointments() {
  const colours = useColours();
  const router = useRouter();
  const { tier } = useSession();
  const priority = TIER_RANK[tier] >= TIER_RANK.signature;
  const [kind, setKind] = useState<Appointment["kind"]>(priority ? "fitting" : "consultation");
  const [showroom, setShowroom] = useState(showrooms[0]?.id ?? "charlotte");

  const upcoming = appointments.filter((entry) => entry.requestedFor > Date.now());
  const past = appointments.filter((entry) => entry.requestedFor <= Date.now());

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button label="Request this appointment" size="lg" onPress={() => router.back()} />
          <Text variant="bodySmall" tone="muted" center>
            {priority
              ? "Members get priority. The showroom confirms within one working day."
              : "The showroom will confirm a time with you."}
          </Text>
        </View>
      }
    >
      <ScreenHeader eyebrow="The house" title="Appointments" />

      {upcoming.length > 0 ? (
        <Section title="Coming up">
          {upcoming.map((appointment) => (
            <Card key={appointment.id}>
              <Text variant="eyebrow" tone="primary">
                {APPOINTMENT_LABELS[appointment.kind]} · {appointment.status}
              </Text>
              <Text variant="subheading">{showroomById(appointment.showroomId)?.city ?? "Showroom"}</Text>
              <Row label={longDate(appointment.requestedFor)} value={relativeDate(appointment.requestedFor)} />
              {appointment.note ? (
                <Text variant="bodySmall" tone="muted">
                  {appointment.note}
                </Text>
              ) : null}
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Book something">
        <Text variant="eyebrow" tone="muted">
          What for
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {(Object.keys(APPOINTMENT_LABELS) as Appointment["kind"][]).map((value) => {
            const active = kind === value;
            const locked = !priority && value !== "consultation";
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: locked }}
                accessibilityLabel={`${APPOINTMENT_LABELS[value]}${locked ? ", members only" : ""}`}
                disabled={locked}
                onPress={() => setKind(value)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: space.lg,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colours.primary : colours.border,
                  opacity: locked ? 0.4 : 1,
                }}
              >
                <Text variant="label" tone={active ? "primary" : "default"}>
                  {APPOINTMENT_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="eyebrow" tone="muted" style={{ paddingTop: space.md }}>
          Where
        </Text>
        <View style={{ gap: space.sm }}>
          {showrooms.map((room) => {
            const active = showroom === room.id;
            return (
              <Pressable
                key={room.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${room.city}, ${room.hours}`}
                onPress={() => setShowroom(room.id)}
                style={{
                  padding: space.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colours.primary : colours.border,
                }}
              >
                <Text variant="subheading">{room.city}</Text>
                <Text variant="bodySmall" tone="muted">
                  {room.hours}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {past.length > 0 ? (
        <Section title="Previously">
          {past.map((appointment) => (
            <Row
              key={appointment.id}
              label={`${APPOINTMENT_LABELS[appointment.kind]}, ${showroomById(appointment.showroomId)?.city ?? ""}`}
              value={longDate(appointment.requestedFor)}
            />
          ))}
        </Section>
      ) : (
        <Section title="Previously">
          <EmptyBlock title="Nothing yet" description="Your visits to the house will be listed here." />
        </Section>
      )}
    </Screen>
  );
}
