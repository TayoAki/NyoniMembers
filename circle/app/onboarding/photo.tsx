import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { ErrorBlock } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

/**
 * The portrait every preview is built from. Guidance matters more than the camera here: a bad photo
 * is the single biggest cause of a preview a member does not believe.
 */
export default function OnboardingPhoto() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(from: "camera" | "library") {
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

    if (result.canceled) return;
    setUri(result.assets[0]?.uri ?? null);
  }

  return (
    <Screen
      footer={
        <Button
          label={uri ? "Use this photo" : "Continue without a photo"}
          size="lg"
          variant={uri ? "primary" : "secondary"}
          onPress={() => router.push("/onboarding/preferences")}
        />
      }
    >
      <ScreenHeader
        eyebrow="Step 1 of 3"
        title="A photo of you"
        description="Previews are built from this. You can replace it whenever you like."
      />

      <View style={{ gap: space.lg }}>
        {uri ? (
          <Photo productId={undefined} fallbackLabel="Your portrait" />
        ) : (
          <Photo productId="nyoni-cascata-2" fallbackLabel="Example" />
        )}

        <View style={{ gap: space.sm }}>
          <Text variant="subheading">What works best</Text>
          {[
            "Stand back far enough to be in frame from head to shoes.",
            "Face the camera, arms relaxed at your sides.",
            "Even daylight, a plain wall behind you.",
            "Close-fitting clothes, so the tailoring sits where it should.",
          ].map((line) => (
            <Text key={line} variant="bodySmall" tone="muted">
              · {line}
            </Text>
          ))}
        </View>

        {error ? <ErrorBlock title="Permission needed" description={error} /> : null}

        <View style={{ gap: space.md }}>
          <Button label="Take a photo" onPress={() => void choose("camera")} />
          <Button label="Choose from your library" variant="secondary" onPress={() => void choose("library")} />
        </View>

        <Text variant="bodySmall" tone="muted">
          A preview shows how a look reads on you. Your clothier confirms the fit at the showroom.
        </Text>
      </View>
    </Screen>
  );
}
