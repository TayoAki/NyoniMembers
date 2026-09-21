import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { InlineNotice, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

type Stage = "idle" | "uploading" | "detecting" | "extracting" | "review" | "failed";

const STEPS: { key: Stage; label: string }[] = [
  { key: "uploading", label: "Sending your photo" },
  { key: "detecting", label: "Finding the garments" },
  { key: "extracting", label: "Cutting each one out" },
];

/**
 * Adding a piece is a pipeline, so the screen shows the pipeline. No invented percentage and no
 * estimated finish time: the steps say what is happening and nothing more.
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

    if (!result.canceled) setStage("uploading");
  }

  const running = stage === "uploading" || stage === "detecting" || stage === "extracting";

  return (
    <Screen>
      <PageHeading
        eyebrow="Wardrobe"
        title="Add a piece"
        subtitle="Photograph a garment you already own and the house will cut it out for you."
      />

      {error ? <InlineNotice tone="error" title="Permission needed" description={error} /> : null}

      {stage === "idle" ? (
        <Section>
          <Button label="Take a photo" onPress={() => void pick("camera")} />
          <Button label="Choose from your library" variant="secondary" onPress={() => void pick("library")} />
          <Text variant="body" tone="muted">
            Lay the garment flat or hang it against a plain wall. One piece per photo works best, though the house can
            find several if you photograph a whole outfit.
          </Text>
        </Section>
      ) : null}

      {running ? (
        <Section title="Working on it">
          <OutlinePanel>
            {STEPS.map((step) => (
              <DetailRow
                key={step.key}
                label={step.label}
                value={step.key === stage ? "in progress" : "waiting"}
                tone={step.key === stage ? "accent" : undefined}
              />
            ))}
          </OutlinePanel>
          <LoadingState label="This usually takes under a minute." />
          <Button label="Show me the result" variant="secondary" onPress={() => setStage("review")} />
        </Section>
      ) : null}

      {stage === "review" ? (
        <Section title="Three pieces found">
          <Text variant="body" tone="muted">
            Choose the ones to keep. Anything you leave unselected is discarded, and nothing joins your wardrobe until
            you confirm.
          </Text>
          <View style={{ gap: space.x3 }}>
            <Button label="Add them to my wardrobe" onPress={() => router.replace("/wardrobe")} />
            <Button label="Start again" variant="secondary" onPress={() => setStage("idle")} />
          </View>
        </Section>
      ) : null}

      {stage === "failed" ? (
        <InlineNotice
          tone="error"
          title="The house could not read that photo"
          description="Try better light, or a plainer background. Your photo has not been kept."
          actionLabel="Try again"
          onAction={() => setStage("idle")}
        />
      ) : null}
    </Screen>
  );
}
