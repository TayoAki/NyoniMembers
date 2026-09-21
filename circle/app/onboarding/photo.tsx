import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { ImageWell } from "@/components/ui/product";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { InlineNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

const GUIDANCE = [
  "Stand back far enough to be in frame from head to shoes.",
  "Face the camera, arms relaxed at your sides.",
  "Even daylight, a plain wall behind you.",
  "Close-fitting clothes, so the tailoring sits where it should.",
];

/** The portrait every preview is built from. Guidance matters more here than the camera does. */
export default function OnboardingPhoto() {
  const router = useRouter();
  const [chosen, setChosen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(from: "camera" | "library") {
    setError(null);
    const permission =
      from === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        from === "camera"
          ? "Nyoni Circle needs the camera to take your portrait. You can allow it in Settings."
          : "Nyoni Circle needs access to your photos to use one you already have.",
      );
      return;
    }

    const result =
      from === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ["images"] });

    if (!result.canceled) setChosen(true);
  }

  return (
    <Screen
      footer={
        <Button
          label={chosen ? "Use this photo" : "Continue without a photo"}
          variant={chosen ? "primary" : "secondary"}
          onPress={() => router.push("/onboarding/preferences")}
        />
      }
    >
      <PageHeading
        eyebrow="Step 1 of 3"
        title="A photo of you"
        subtitle="Previews are built from this. You can replace it whenever you like."
      />

      <ImageWell productId={chosen ? undefined : "nyoni-cascata-2"} label="Your portrait" isolated />

      <Section title="What works best">
        <View style={{ gap: space.x2 }}>
          {GUIDANCE.map((line) => (
            <Text key={line} variant="body" tone="muted">
              · {line}
            </Text>
          ))}
        </View>
      </Section>

      {error ? (
        <Section>
          <InlineNotice tone="error" title="Permission needed" description={error} />
        </Section>
      ) : null}

      <Section>
        <Button label="Take a photo" onPress={() => void pick("camera")} />
        <Button label="Choose from your library" variant="secondary" onPress={() => void pick("library")} />
      </Section>

      <Section>
        <Text variant="caption" tone="muted">
          A preview shows how a look reads on you. Your clothier confirms the fit at the showroom.
        </Text>
      </Section>
    </Screen>
  );
}
