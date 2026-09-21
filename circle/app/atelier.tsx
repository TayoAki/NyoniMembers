import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { atelier } from "@/lib/fixtures";
import { money, pluralize } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/**
 * The paywall, which is a screen rather than a modal afterthought. Price, period, what renews and
 * how to restore are all legible before anyone taps buy. M7 replaces the buttons with RevenueCat.
 */
export default function Atelier() {
  const colours = useColours();
  const router = useRouter();
  const { hasAtelier, atelierSource, previewDaysLeft, setDemoState } = useSession();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");

  if (hasAtelier) {
    return (
      <Screen>
        <ScreenHeader
          eyebrow="Atelier"
          title="You already have it"
          description={
            atelierSource === "membership"
              ? "Atelier is included with your membership, at no extra cost."
              : atelierSource === "preview"
                ? `Your preview has ${pluralize(previewDaysLeft, "day")} left.`
                : "Your subscription is active."
          }
        />
        <Section title="What it unlocks">
          <Card>
            {atelier.features.map((feature) => (
              <Text key={feature} variant="bodySmall">
                · {feature}
              </Text>
            ))}
          </Card>
        </Section>
        {atelierSource === "subscription" ? (
          <Section>
            <Button label="Manage your subscription" variant="secondary" onPress={() => router.back()} />
            <Text variant="bodySmall" tone="muted">
              Subscriptions are billed by the App Store and managed there. Cancelling stops the renewal and you keep
              Atelier until the period ends.
            </Text>
          </Section>
        ) : null}
        {atelierSource === "preview" ? (
          <Section>
            <Button label="Subscribe now" onPress={() => setDemoState("atelier")} />
          </Section>
        ) : null}
      </Screen>
    );
  }

  const price = plan === "annual" ? atelier.annualUsd : atelier.monthlyUsd;

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button
            label={`Subscribe · ${money(price)} ${plan === "annual" ? "a year" : "a month"}`}
            size="lg"
            onPress={() => setDemoState("atelier")}
          />
          <Text variant="bodySmall" tone="muted" center>
            Renews automatically until you cancel. Manage or cancel any time in your App Store settings.
          </Text>
        </View>
      }
    >
      <ScreenHeader
        eyebrow="Atelier"
        title="See it on you, before you buy it"
        description="Everything the house can tell you about your own wardrobe, and the fitting room that shows a look on your photo."
      />

      <Section title="What you get">
        <Card>
          {atelier.features.map((feature) => (
            <Text key={feature} variant="bodySmall">
              · {feature}
            </Text>
          ))}
        </Card>
      </Section>

      <Section title="Choose a plan">
        <View style={{ gap: space.md }}>
          {(
            [
              ["annual", `${money(atelier.annualUsd)} a year`, `Works out at ${money(atelier.annualUsd / 12)} a month`],
              ["monthly", `${money(atelier.monthlyUsd)} a month`, "Cancel any time"],
            ] as const
          ).map(([key, title, detail]) => {
            const active = plan === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${title}. ${detail}`}
                onPress={() => setPlan(key)}
                style={{
                  padding: space.lg,
                  gap: space.xs,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colours.primary : colours.border,
                }}
              >
                <Text variant="subheading" tone={active ? "primary" : "default"}>
                  {title}
                </Text>
                <Text variant="bodySmall" tone="muted">
                  {detail}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Already a member?">
        <Card>
          <Text variant="bodySmall" tone="muted">
            Atelier is included with Signature, Prestige and Circle Elite membership. If you hold one, sign in with the
            email the house has on file and it opens on its own.
          </Text>
          <Button label="About membership" variant="ghost" onPress={() => router.push("/circle")} />
        </Card>
      </Section>

      <Section>
        <Button label="Restore a purchase" variant="ghost" onPress={() => setDemoState("atelier")} />
      </Section>
    </Screen>
  );
}
