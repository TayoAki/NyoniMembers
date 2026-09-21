import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/** Membership is reviewed by the house, so this collects an application rather than opening an account. */
export default function SignUp() {
  const colours = useColours();
  const router = useRouter();
  const { setDemoState } = useSession();
  const [fields, setFields] = useState({ name: "", email: "", city: "" });

  const inputStyle = {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.md,
    color: colours.foreground,
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
  } as const;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Apply"
        title="Join the Circle"
        description="Membership is reviewed by the house. Tell us who you are and your nearest showroom will be in touch."
      />

      <View style={{ gap: space.lg }}>
        {(
          [
            ["Full name", "name", "name"],
            ["Email", "email", "email"],
            ["Nearest city", "city", "off"],
          ] as const
        ).map(([label, key, complete]) => (
          <View key={key} style={{ gap: space.sm }}>
            <Text variant="eyebrow" tone="muted">
              {label}
            </Text>
            <TextInput
              value={fields[key]}
              onChangeText={(value) => setFields((prior) => ({ ...prior, [key]: value }))}
              placeholderTextColor={colours.muted}
              autoCapitalize={key === "email" ? "none" : "words"}
              autoComplete={complete}
              keyboardType={key === "email" ? "email-address" : "default"}
              accessibilityLabel={label}
              style={inputStyle}
            />
          </View>
        ))}

        <Button
          label="Send my application"
          size="lg"
          onPress={() => {
            setDemoState("preview");
            router.replace("/onboarding/photo");
          }}
        />
      </View>

      <Card style={{ marginTop: space.xl }}>
        <Text variant="eyebrow" tone="primary">
          What happens next
        </Text>
        <Text variant="bodySmall" tone="muted">
          A clothier reads every application. If the house opens an account for you, your wardrobe arrives already
          dressed in the Nyoni capsule, and your first fourteen days include everything Atelier unlocks.
        </Text>
      </Card>
    </Screen>
  );
}
