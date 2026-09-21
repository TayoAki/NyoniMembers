import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { OutlinePanel, Panel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { atelier } from "@/lib/fixtures";
import { money, pluralize } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

/**
 * The paywall, as a screen rather than a modal afterthought. Price, period, what renews and how to
 * restore are all legible before anyone taps buy, which the App Store requires and a member is owed
 * anyway.
 */
export default function Atelier() {
  const surface = useSurface();
  const router = useRouter();
  const { hasAtelier, atelierSource, previewDaysLeft, setDemoState } = useSession();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");

  if (hasAtelier) {
    return (
      <Screen>
        <PageHeading
          eyebrow="Atelier"
          title="You already have it"
          subtitle={
            atelierSource === "membership"
              ? "Atelier is included with your membership, at no extra cost."
              : atelierSource === "preview"
                ? `Your preview has ${pluralize(previewDaysLeft, "day")} left.`
                : "Your subscription is active."
          }
        />

        <Section title="What it unlocks">
          <Panel>
            {atelier.features.map((feature) => (
              <Text key={feature} variant="body">
                · {feature}
              </Text>
            ))}
          </Panel>
        </Section>

        {atelierSource === "subscription" ? (
          <Section>
            <Text variant="body" tone="muted">
              Atelier is billed by the App Store and managed there. Cancelling stops the renewal, and you keep it until
              the period ends.
            </Text>
            <Button label="Manage in the App Store" variant="secondary" onPress={() => router.back()} />
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
        <View style={{ gap: space.x2 }}>
          <Button
            label={`Subscribe · ${money(price)} ${plan === "annual" ? "a year" : "a month"}`}
            onPress={() => setDemoState("atelier")}
          />
          <Text variant="caption" tone="muted" center>
            Renews automatically until you cancel. Manage or cancel any time in your App Store settings.
          </Text>
        </View>
      }
    >
      <PageHeading
        eyebrow="Atelier"
        title="See it on you, before you buy it"
        subtitle="Everything the house can tell you about your own wardrobe, and the fitting room that puts a look on your photo."
      />

      <Section title="What you get">
        <Panel>
          {atelier.features.map((feature) => (
            <Text key={feature} variant="body">
              · {feature}
            </Text>
          ))}
        </Panel>
      </Section>

      <Section title="Choose a plan">
        <View accessibilityRole="radiogroup" accessibilityLabel="Choose a plan" style={{ gap: space.x3 }}>
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
                  padding: space.x4,
                  gap: space.x1,
                  borderRadius: radius.card,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? surface.text : surface.controlLine,
                }}
              >
                <Text variant="section">{title}</Text>
                <Text variant="caption" tone="muted">
                  {detail}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Already a member?">
        <OutlinePanel>
          <Text variant="body" tone="muted">
            Atelier is included with Signature, Prestige and Circle Elite membership. If you hold one, sign in with the
            email the house has on file and it opens on its own.
          </Text>
          <TextAction label="About membership" onPress={() => router.push("/circle")} />
        </OutlinePanel>
      </Section>

      <Section>
        <TextAction label="Restore a purchase" arrow={false} onPress={() => setDemoState("atelier")} />
      </Section>
    </Screen>
  );
}
