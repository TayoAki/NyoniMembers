import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { DEMO_STATES, DEMO_STATE_LABELS, useSession, type DemoState } from "@/lib/session";
import { fontFamily, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

/**
 * Identity is fixture-backed until Clerk lands. The provider buttons are real layout with nothing
 * behind them; the picker below stands in for signing in as different people, so every screen's
 * free, subscribed and member states can be reviewed on a device.
 */
export default function SignIn() {
  const surface = useSurface();
  const router = useRouter();
  const { setDemoState } = useSession();
  const [email, setEmail] = useState("");

  function enter(state: DemoState) {
    setDemoState(state);
    router.replace("/(tabs)");
  }

  return (
    <Screen>
      <PageHeading
        eyebrow="Members only"
        title="Sign in"
        subtitle="Use the email the house has on file. New members are reviewed before an account opens."
      />

      <View style={{ gap: space.x3 }}>
        <Text variant="eyebrow" tone="muted">
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={surface.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          accessibilityLabel="Email address"
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
        <Button label="Email me a code" onPress={() => enter("circle")} />
        <Text variant="caption" tone="muted" center>
          or
        </Text>
        <Button label="Continue with Apple" variant="secondary" onPress={() => enter("circle")} />
        <Button label="Continue with Google" variant="secondary" onPress={() => enter("circle")} />
      </View>

      <Section title="Preview build" major>
        <OutlinePanel>
          <Text variant="caption" tone="muted">
            No accounts exist yet. Choose who to sign in as, and the whole app behaves as that member would see it.
          </Text>
          {DEMO_STATES.filter((state) => state !== "signed-out").map((state) => (
            <Button key={state} label={DEMO_STATE_LABELS[state]} variant="secondary" onPress={() => enter(state)} />
          ))}
        </OutlinePanel>
      </Section>
    </Screen>
  );
}
