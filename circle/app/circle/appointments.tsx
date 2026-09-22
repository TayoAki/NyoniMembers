import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { appointments, showroomById, showrooms } from "@/lib/fixtures";
import { longDate, relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { chrome, radius, space } from "@/lib/theme";
import { APPOINTMENT_LABELS, TIER_RANK, type Appointment } from "@/lib/types";
import { useSurface } from "@/lib/use-theme";

/** Booking is free at every tier. Only priority differs, and the screen says so rather than hiding it. */
export default function Appointments() {
  const router = useRouter();
  const surface = useSurface();
  const { tier } = useSession();
  const priority = TIER_RANK[tier] >= TIER_RANK.signature;
  const [kind, setKind] = useState<Appointment["kind"]>(priority ? "fitting" : "consultation");
  const [showroom, setShowroom] = useState(showrooms[0]?.id ?? "charlotte");

  // Read once per mount: "today" must not move under the member while the screen is open.
  const [now] = useState(() => Date.now());
  const upcoming = appointments.filter((entry) => entry.requestedFor > now);
  const past = appointments.filter((entry) => entry.requestedFor <= now);

  return (
    <Screen
      footer={
        <View style={{ gap: space.x2 }}>
          <Button label="Request this appointment" onPress={() => router.back()} />
          <Text variant="caption" tone="muted" center>
            A request is not a confirmed appointment. The showroom confirms a time with you
            {priority ? " within one working day" : ""}.
          </Text>
        </View>
      }
    >
      <PageHeading eyebrow="The house" title="Appointments" />

      {upcoming.length > 0 ? (
        <Section title="Coming up">
          {upcoming.map((appointment) => (
            <OutlinePanel key={appointment.id}>
              <Text variant="eyebrow" tone="accent">
                {APPOINTMENT_LABELS[appointment.kind]} · {appointment.status}
              </Text>
              <Text variant="section">{showroomById(appointment.showroomId)?.city ?? "Showroom"}</Text>
              <DetailRow label={longDate(appointment.requestedFor)} value={relativeDate(appointment.requestedFor)} />
              {appointment.note ? (
                <Text variant="caption" tone="muted">
                  {appointment.note}
                </Text>
              ) : null}
            </OutlinePanel>
          ))}
        </Section>
      ) : null}

      <Section title="Book something">
        <Text variant="eyebrow" tone="muted">
          What for
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="What the appointment is for"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x2 }}
        >
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
                  minHeight: chrome.tapTarget,
                  justifyContent: "center",
                  paddingHorizontal: space.x4,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: active ? surface.text : surface.controlLine,
                  backgroundColor: active ? surface.text : "transparent",
                  opacity: locked ? 0.4 : 1,
                }}
              >
                <Text variant="button" style={{ color: active ? surface.background : surface.text }}>
                  {APPOINTMENT_LABELS[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!priority ? (
          <Text variant="caption" tone="muted">
            Fittings and alterations are part of Signature membership and above. A consultation is open to everyone.
          </Text>
        ) : null}

        <Text variant="eyebrow" tone="muted" style={{ paddingTop: space.x3 }}>
          Where
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Showroom" style={{ gap: space.x2 }}>
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
                  padding: space.x4,
                  borderRadius: radius.card,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? surface.text : surface.controlLine,
                }}
              >
                <Text variant="section">{room.city}</Text>
                <Text variant="caption" tone="muted">
                  {room.hours}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Previously" major>
        {past.length === 0 ? (
          <EmptyState title="Nothing yet" description="Your visits to the house will be listed here." />
        ) : (
          <OutlinePanel>
            {past.map((appointment) => (
              <DetailRow
                key={appointment.id}
                label={`${APPOINTMENT_LABELS[appointment.kind]}, ${showroomById(appointment.showroomId)?.city ?? ""}`}
                value={longDate(appointment.requestedFor)}
              />
            ))}
          </OutlinePanel>
        )}
      </Section>
    </Screen>
  );
}
