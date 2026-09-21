import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { DEMO_STATES, DEMO_STATE_LABELS, useSession, type DemoState } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/**
 * Identity is fixture-backed until M2 wires Clerk in. The provider buttons are real layout with no
 * provider behind them, and the state picker below stands in for signing in as different people so
 * every screen's free, subscribed and member states can be reviewed on a device.
 */
export default function SignIn() {
  const colours = useColours();
  const router = useRouter();
  const { setDemoState } = useSession();
  const [email, setEmail] = useState("");

  function enter(state: DemoState) {
    setDemoState(state);
    router.replace("/(tabs)");
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Members only"
        title="Sign in"
        description="Use the email the house has on file. New members are reviewed before an account opens."
      />

      <View style={{ gap: space.md }}>
        <Text variant="eyebrow" tone="muted">
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colours.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          accessibilityLabel="Email address"
          style={{
            minHeight: 52,
            paddingHorizontal: space.lg,
            borderWidth: 1,
            borderColor: colours.border,
            borderRadius: radius.md,
            color: colours.foreground,
            fontFamily: "Manrope_400Regular",
            fontSize: 16,
          }}
        />
        <Button label="Email me a code" onPress={() => enter("circle")} size="lg" />
        <Text variant="bodySmall" tone="muted" center>
          or
        </Text>
        <Button label="Continue with Apple" variant="secondary" onPress={() => enter("circle")} />
        <Button label="Continue with Google" variant="secondary" onPress={() => enter("circle")} />
      </View>

      <View
        style={{
          marginTop: space.xxl,
          padding: space.lg,
          gap: space.md,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colours.borderStrong,
          borderRadius: radius.lg,
        }}
      >
        <Text variant="eyebrow" tone="primary">
          Preview build
        </Text>
        <Text variant="bodySmall" tone="muted">
          No accounts exist yet. Choose who to sign in as, and the whole app behaves as that member would see it.
        </Text>
        {DEMO_STATES.filter((state) => state !== "signed-out").map((state) => (
          <Pressable
            key={state}
            accessibilityRole="button"
            onPress={() => enter(state)}
            style={({ pressed }) => ({
              minHeight: 48,
              justifyContent: "center",
              paddingHorizontal: space.lg,
              borderWidth: 1,
              borderColor: colours.border,
              borderRadius: radius.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="label">{DEMO_STATE_LABELS[state]}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
