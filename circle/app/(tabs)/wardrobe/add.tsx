import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { ErrorBlock, LoadingBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

type Stage = "idle" | "uploading" | "detecting" | "extracting" | "done" | "failed";

const STEPS: { key: Stage; label: string }[] = [
  { key: "uploading", label: "Sending your photo" },
  { key: "detecting", label: "Finding the garments" },
  { key: "extracting", label: "Cutting each one out" },
];

/**
 * Adding a piece is a pipeline, so the screen shows the pipeline. Progress here is a fixture; M5
 * replaces it with the real job so the steps say what the server is actually doing.
 */
export default function AddPiece() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  async function pick(from: "camera" | "library") {
    setError(null);
    const permission =
      from === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError("Nyoni Circle needs permission before it can use that. You can allow it in Settings.");
      return;
    }

    const result =
      from === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ["images"] });

    if (result.canceled) return;
    setStage("uploading");
  }

  const running = stage === "uploading" || stage === "detecting" || stage === "extracting";

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Wardrobe"
        title="Add a piece"
        description="Photograph a garment you already own and the house will cut it out for you."
      />

      {error ? <ErrorBlock title="Permission needed" description={error} /> : null}

      {stage === "idle" ? (
        <View style={{ gap: space.md }}>
          <Button label="Take a photo" onPress={() => void pick("camera")} />
          <Button label="Choose from your library" variant="secondary" onPress={() => void pick("library")} />
          <Text variant="bodySmall" tone="muted">
            Lay the garment flat or hang it against a plain wall. One piece per photo works best, though the house can
            find several if you photograph a whole outfit.
          </Text>
        </View>
      ) : null}

      {running ? (
        <Section title="Working on it">
          <Card>
            {STEPS.map((step) => (
              <Row
                key={step.key}
                label={step.label}
                value={step.key === stage ? "in progress" : "waiting"}
                tone={step.key === stage ? "primary" : "muted"}
              />
            ))}
          </Card>
          <LoadingBlock label="This usually takes under a minute." />
          <Button label="Show me the result" variant="secondary" onPress={() => setStage("done")} />
        </Section>
      ) : null}

      {stage === "done" ? (
        <Section title="Three pieces found">
          <Text variant="bodySmall" tone="muted">
            Choose the ones to keep. Anything you leave unselected is discarded, and nothing is added to your wardrobe
            until you confirm.
          </Text>
          <Button label="Add them to my wardrobe" onPress={() => router.replace("/wardrobe")} />
          <Button label="Start again" variant="ghost" onPress={() => setStage("idle")} />
        </Section>
      ) : null}

      {stage === "failed" ? (
        <ErrorBlock
          description="The house could not read that photo. Try better light, or a plainer background."
          onRetry={() => setStage("idle")}
        />
      ) : null}
    </Screen>
  );
}
