import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { atelier } from "@/lib/fixtures";
import { pluralize } from "@/lib/format";
import { space } from "@/lib/theme";

const STEPS = [
  "Open Drops and find a piece worth a second look.",
  "Build a look, or ask the stylist to build one for you.",
  "Preview it on yourself, then book a fitting to settle the fit.",
];

export default function OnboardingReady() {
  const router = useRouter();

  return (
    <Screen footer={<Button label="Open my wardrobe" onPress={() => router.replace("/(tabs)")} />}>
      <PageHeading
        eyebrow="Step 3 of 3"
        title="Your wardrobe is dressed"
        subtitle="Twenty-two Nyoni pieces are already in it, so you can build a look before you photograph a thing."
      />

      <Panel>
        <Text variant="eyebrow" tone="accent">
          {pluralize(atelier.previewDays, "day")} of Atelier, on the house
        </Text>
        <Text variant="body" tone="muted">
          Previews on your own photo, your wardrobe analytics, HD images and inspiration boards are all open until your
          preview ends. Nothing is charged, and nothing renews on its own.
        </Text>
      </Panel>

      <Section title="Where to start">
        <View style={{ gap: space.x2 }}>
          {STEPS.map((step, index) => (
            <Text key={step} variant="body" tone="muted">
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      </Section>
    </Screen>
  );
}
