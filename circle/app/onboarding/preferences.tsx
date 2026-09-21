import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { showrooms } from "@/lib/fixtures";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

const FITS = ["Close", "Tailored", "Relaxed"] as const;
const AVOID = ["Yellow", "Pink", "Green", "Bold pattern", "Double breasted"] as const;

export default function OnboardingPreferences() {
  const router = useRouter();
  const [fit, setFit] = useState<string>("Tailored");
  const [avoid, setAvoid] = useState<string[]>([]);
  const [showroom, setShowroom] = useState(showrooms[0]?.id ?? "charlotte");

  return (
    <Screen footer={<Button label="Continue" size="lg" onPress={() => router.push("/onboarding/ready")} />}>
      <ScreenHeader
        eyebrow="Step 2 of 3"
        title="How you like to dress"
        description="Your concierge uses this. You can change any of it later."
      />

      <Section title="Fit">
        <Choices options={[...FITS]} selected={[fit]} onToggle={setFit} />
      </Section>

      <Section title="Anything to avoid" eyebrow="Optional">
        <Choices
          options={[...AVOID]}
          selected={avoid}
          onToggle={(value) =>
            setAvoid((prior) => (prior.includes(value) ? prior.filter((item) => item !== value) : [...prior, value]))
          }
        />
      </Section>

      <Section title="Your showroom">
        <Choices
          options={showrooms.map((room) => room.city)}
          selected={[showrooms.find((room) => room.id === showroom)?.city ?? ""]}
          onToggle={(city) => setShowroom(showrooms.find((room) => room.city === city)?.id ?? showroom)}
        />
      </Section>
    </Screen>
  );
}

function Choices({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const colours = useColours();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={option}
            onPress={() => onToggle(option)}
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? colours.primary : colours.border,
              backgroundColor: active ? colours.primary : "transparent",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text variant="label" tone={active ? "onPrimary" : "default"}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
