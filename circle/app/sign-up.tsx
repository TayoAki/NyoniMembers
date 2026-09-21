import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useSession } from "@/lib/session";
import { fontFamily, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

const FIELDS = [
  { key: "name", label: "Full name", complete: "name" },
  { key: "email", label: "Email", complete: "email" },
  { key: "city", label: "Nearest city", complete: "off" },
] as const;

/** Membership is reviewed by the house, so this takes an application rather than opening an account. */
export default function SignUp() {
  const surface = useSurface();
  const router = useRouter();
  const { setDemoState } = useSession();
  const [fields, setFields] = useState({ name: "", email: "", city: "" });

  return (
    <Screen>
      <PageHeading
        eyebrow="Apply"
        title="Join the Circle"
        subtitle="Membership is reviewed by the house. Tell us who you are and your nearest showroom will be in touch."
      />

      <View style={{ gap: space.x5 }}>
        {FIELDS.map((field) => (
          <View key={field.key} style={{ gap: space.x2 }}>
            <Text variant="eyebrow" tone="muted">
              {field.label}
            </Text>
            <TextInput
              value={fields[field.key]}
              onChangeText={(value) => setFields((prior) => ({ ...prior, [field.key]: value }))}
              placeholderTextColor={surface.muted}
              autoCapitalize={field.key === "email" ? "none" : "words"}
              autoComplete={field.complete}
              keyboardType={field.key === "email" ? "email-address" : "default"}
              accessibilityLabel={field.label}
              style={{
                minHeight: 52,
                paddingHorizontal: space.x4,
                borderWidth: 1,
                borderColor: surface.controlLine,
                borderRadius: radius.sm,
                color: surface.text,
                fontFamily: fontFamily.ui,
                fontSize: 16,
              }}
            />
          </View>
        ))}

        <Button
          label="Send my application"
          onPress={() => {
            setDemoState("preview");
            router.replace("/onboarding/photo");
          }}
        />
      </View>

      <Section title="What happens next">
        <Panel>
          <Text variant="body" tone="muted">
            A clothier reads every application. If the house opens an account for you, your wardrobe arrives already
            dressed in the Nyoni capsule, and your first fourteen days include everything Atelier unlocks.
          </Text>
        </Panel>
      </Section>
    </Screen>
  );
}
