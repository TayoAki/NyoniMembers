import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, NavRow, Row } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { member } from "@/lib/fixtures";
import { DEMO_STATES, DEMO_STATE_LABELS, useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { TIER_LABELS } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

export default function Settings() {
  const colours = useColours();
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
      <ScreenHeader eyebrow="Your studio" title="Settings" />

      <Section title="Account">
        <Card>
          <Row label="Name" value={current?.name ?? member.name} />
          <Row label="Email" value={current?.email ?? member.email} />
          <Row label="Membership" value={TIER_LABELS[tier]} />
          <Row
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
        </Card>
      </Section>

      <Section title="Notifications">
        <Card>
          {(
            [
              ["drops", "When a drop opens"],
              ["previews", "When a preview is ready"],
              ["fittings", "Before a fitting"],
            ] as const
          ).map(([key, label]) => (
            <View
              key={key}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}
            >
              <Text variant="body">{label}</Text>
              <Switch
                value={notifications[key]}
                onValueChange={(value) => setNotifications((prior) => ({ ...prior, [key]: value }))}
                accessibilityLabel={label}
                trackColor={{ true: colours.primary, false: colours.border }}
              />
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Subscription">
        <Card>
          <Text variant="bodySmall" tone="muted">
            Atelier is billed by the App Store. Manage or cancel it in your App Store settings; cancelling stops the
            renewal and you keep Atelier until the period ends.
          </Text>
          <Button label="Manage Atelier" variant="secondary" onPress={() => router.push("/atelier")} />
        </Card>
      </Section>

      <Section>
        <NavRow label="Your clothier" onPress={() => router.push("/circle/clothier")} />
        <NavRow label="Orders" onPress={() => router.push("/orders")} />
      </Section>

      <Section title="Preview build">
        <Card>
          <Text variant="bodySmall" tone="muted">
            No backend is connected yet. Switch between the states a member can be in to review every screen.
          </Text>
          {DEMO_STATES.map((state) => (
            <Button
              key={state}
              label={DEMO_STATE_LABELS[state]}
              variant={demoState === state ? "primary" : "ghost"}
              onPress={() => setDemoState(state)}
            />
          ))}
        </Card>
      </Section>

      <Section>
        <Button label="Sign out" variant="secondary" onPress={() => setDemoState("signed-out")} />
        <Button label="Delete your account" variant="danger" onPress={confirmDelete} />
        <Text variant="bodySmall" tone="muted">
          Deleting your account removes your wardrobe, looks and previews from the house. It does not cancel your
          membership or your App Store subscription.
        </Text>
      </Section>
    </Screen>
  );
}
