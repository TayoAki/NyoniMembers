import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { DetailRow, OutlinePanel, ServiceRow } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { member } from "@/lib/fixtures";
import { DEMO_STATES, DEMO_STATE_LABELS, useSession } from "@/lib/session";
import { ny, space } from "@/lib/theme";
import { TIER_LABELS } from "@/lib/types";

const NOTIFICATIONS = [
  { key: "drops", label: "When a drop opens" },
  { key: "previews", label: "When a preview is ready" },
  { key: "fittings", label: "Before a fitting" },
] as const;

export default function Settings() {
  const router = useRouter();
  const { member: current, tier, atelierSource, setDemoState, demoState } = useSession();
  const [notifications, setNotifications] = useState({ drops: true, previews: true, fittings: true });

  function confirmDelete() {
    Alert.alert(
      "Delete your account",
      "This removes your wardrobe, your looks and your previews. It does not cancel your Circle membership or an App Store subscription, which the house and the App Store handle separately.",
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => setDemoState("signed-out") },
      ],
    );
  }

  return (
    <Screen>
      <PageHeading eyebrow="Your account" title="Settings" />

      <Section title="Account">
        <OutlinePanel>
          <DetailRow label="Name" value={current?.name ?? member.name} />
          <DetailRow label="Email" value={current?.email ?? member.email} />
          <DetailRow label="Membership" value={TIER_LABELS[tier]} />
          <DetailRow
            label="Atelier"
            value={
              atelierSource === "membership"
                ? "Included with membership"
                : atelierSource === "subscription"
                  ? "Subscribed"
                  : atelierSource === "preview"
                    ? "Preview running"
                    : "Not active"
            }
          />
        </OutlinePanel>
      </Section>

      <Section title="Notifications">
        <OutlinePanel>
          {NOTIFICATIONS.map((item) => (
            <View
              key={item.key}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}
            >
              <Text variant="body">{item.label}</Text>
              <Switch
                value={notifications[item.key]}
                onValueChange={(value) => setNotifications((prior) => ({ ...prior, [item.key]: value }))}
                accessibilityLabel={item.label}
                trackColor={{ true: ny.gold, false: ny.line }}
              />
            </View>
          ))}
        </OutlinePanel>
      </Section>

      <Section title="Subscription">
        <OutlinePanel>
          <Text variant="body" tone="muted">
            Atelier is billed by the App Store. Manage or cancel it there; cancelling stops the renewal and you keep
            Atelier until the period ends.
          </Text>
          <Button label="Manage Atelier" variant="secondary" onPress={() => router.push("/atelier")} />
        </OutlinePanel>
      </Section>

      <Section>
        <ServiceRow label="Your clothier" onPress={() => router.push("/circle/clothier")} />
        <ServiceRow label="Orders" onPress={() => router.push("/orders")} />
        <ServiceRow label="The Circle" onPress={() => router.push("/circle")} />
      </Section>

      <Section title="Preview build" major>
        <OutlinePanel>
          <Text variant="caption" tone="muted">
            No backend is connected yet. Switch between the states a member can be in to review every screen.
          </Text>
          {DEMO_STATES.map((state) => (
            <Button
              key={state}
              label={DEMO_STATE_LABELS[state]}
              variant={demoState === state ? "primary" : "secondary"}
              onPress={() => setDemoState(state)}
            />
          ))}
        </OutlinePanel>
      </Section>

      <Section>
        <Button label="Sign out" variant="secondary" onPress={() => setDemoState("signed-out")} />
        <Button label="Delete your account" variant="secondary" onPress={confirmDelete} />
        <Text variant="caption" tone="muted">
          Deleting your account removes your wardrobe, looks and previews from the house. It does not cancel your
          membership or your App Store subscription.
        </Text>
      </Section>
    </Screen>
  );
}
