import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { InlineNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { clerkMessage } from "@/lib/clerk-errors";
import { isAuthLive } from "@/lib/config";
import { DEMO_STATES, DEMO_STATE_LABELS, useSession, type DemoState } from "@/lib/session";
import { space } from "@/lib/theme";

/**
 * A code to the member's email and nothing else to remember. No password, because the house never
 * asks for one, and no social buttons here: those need a device build and a redirect the web
 * preview cannot offer, so they appear once the app runs on a phone.
 */
function EmailCodeSignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!isLoaded || !signIn || email.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      await signIn.create({ strategy: "email_code", identifier: email.trim() });
      setSent(true);
    } catch (thrown) {
      setError(clerkMessage(thrown, "We could not send a code to that address."));
    } finally {
      setPending(false);
    }
  }

  async function submitCode() {
    if (!isLoaded || !signIn || code.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: "email_code", code: code.trim() });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
        return;
      }
      setError("That sign-in needs another step we do not support yet. Speak to your clothier.");
    } catch (thrown) {
      setError(clerkMessage(thrown, "That code was not right. Ask for another."));
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: space.x5 }}>
      {error ? <InlineNotice tone="error" title="We could not sign you in" description={error} /> : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!sent && !pending}
        returnKeyType="go"
        onSubmitEditing={sendCode}
      />

      {sent ? (
        <>
          <TextField
            label="Your code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            autoCapitalize="none"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            hint={`Sent to ${email.trim()}.`}
            returnKeyType="go"
            onSubmitEditing={submitCode}
          />
          <Button label="Sign in" pending={pending} onPress={submitCode} />
          <Button
            label="Use a different address"
            variant="secondary"
            onPress={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
          />
        </>
      ) : (
        <Button label="Email me a code" pending={pending} onPress={sendCode} />
      )}
    </View>
  );
}

/** With no Clerk key in the build there are no accounts, so the picker stands in for people. */
function DemoSignIn() {
  const router = useRouter();
  const { setDemoState } = useSession();

  function enter(state: DemoState) {
    setDemoState(state);
    router.replace("/(tabs)");
  }

  return (
    <Section title="Preview build" major>
      <OutlinePanel>
        <Text variant="caption" tone="muted">
          No accounts exist in this build. Choose who to sign in as, and the whole app behaves as that member would see
          it.
        </Text>
        {DEMO_STATES.filter((state) => state !== "signed-out").map((state) => (
          <Button key={state} label={DEMO_STATE_LABELS[state]} variant="secondary" onPress={() => enter(state)} />
        ))}
      </OutlinePanel>
    </Section>
  );
}

export default function SignIn() {
  return (
    <Screen>
      <PageHeading
        eyebrow="Members only"
        title="Sign in"
        subtitle={
          isAuthLive
            ? "Use the email the house has on file. We will send a code — there is no password to remember."
            : "This build has no accounts behind it yet. Pick a member and the app answers as they would see it."
        }
      />
      {isAuthLive ? <EmailCodeSignIn /> : <DemoSignIn />}
    </Screen>
  );
}
