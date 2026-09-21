import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { showrooms } from "@/lib/fixtures";
import { chrome, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

const FITS = ["Close", "Tailored", "Relaxed"];
const AVOID = ["Yellow", "Pink", "Green", "Bold pattern", "Double breasted"];

export default function OnboardingPreferences() {
  const router = useRouter();
  const [fit, setFit] = useState("Tailored");
  const [avoid, setAvoid] = useState<string[]>([]);
  const [showroom, setShowroom] = useState(showrooms[0]?.city ?? "Charlotte");

  return (
    <Screen footer={<Button label="Continue" onPress={() => router.push("/onboarding/ready")} />}>
      <PageHeading
        eyebrow="Step 2 of 3"
        title="How you like to dress"
        subtitle="The stylist uses this. You can change any of it later."
      />

      <Section title="Fit">
        <Choices label="Fit" options={FITS} selected={[fit]} onToggle={setFit} />
      </Section>

      <Section title="Anything to avoid">
        <Choices
          label="Colours and cuts to avoid"
          options={AVOID}
          selected={avoid}
          multi
          onToggle={(value) =>
            setAvoid((prior) => (prior.includes(value) ? prior.filter((item) => item !== value) : [...prior, value]))
          }
        />
      </Section>

      <Section title="Your showroom">
        <Choices
          label="Your showroom"
          options={showrooms.map((room) => room.city)}
          selected={[showroom]}
          onToggle={setShowroom}
        />
      </Section>
    </Screen>
  );
}

function Choices({
  label,
  options,
  selected,
  onToggle,
  multi = false,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  multi?: boolean;
}) {
  const surface = useSurface();
  return (
    <View
      accessibilityRole={multi ? "none" : "radiogroup"}
      accessibilityLabel={label}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x2 }}
    >
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole={multi ? "checkbox" : "radio"}
            accessibilityState={multi ? { checked: active } : { selected: active }}
            accessibilityLabel={option}
            onPress={() => onToggle(option)}
            style={{
              minHeight: chrome.tapTarget,
              justifyContent: "center",
              paddingHorizontal: space.x4,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: active ? surface.text : surface.controlLine,
              backgroundColor: active ? surface.text : "transparent",
            }}
          >
            <Text variant="button" style={{ color: active ? surface.background : surface.text }}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
