import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Panel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { InlineNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { clerkMessage } from "@/lib/clerk-errors";
import { isAuthLive } from "@/lib/config";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

/**
 * An account opens straight away; a *membership* does not. The house sets the tier by hand, so
 * everyone starts as a client with the capsule and the fourteen-day look at Atelier, and a clothier
 * reads the application before anything above that is granted.
 */
function ClerkSignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [fields, setFields] = useState({ name: "", email: "", city: "" });
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof fields, value: string) {
    setFields((prior) => ({ ...prior, [key]: value }));
  }

  async function apply() {
    if (!isLoaded || !signUp || fields.email.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      const [first, ...rest] = fields.name.trim().split(/\s+/).filter(Boolean);
      await signUp.create({
        emailAddress: fields.email.trim(),
        ...(first ? { firstName: first } : {}),
        ...(rest.length ? { lastName: rest.join(" ") } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setSent(true);
    } catch (thrown) {
      setError(clerkMessage(thrown, "We could not take that application."));
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!isLoaded || !signUp || code.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/onboarding/photo");
        return;
      }
      setError("Your account needs another step we do not support yet. Speak to your clothier.");
    } catch (thrown) {
      setError(clerkMessage(thrown, "That code was not right. Ask for another."));
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: space.x5 }}>
      {error ? <InlineNotice tone="error" title="We could not open your account" description={error} /> : null}

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
            hint={`Sent to ${fields.email.trim()}.`}
            returnKeyType="go"
            onSubmitEditing={confirm}
          />
          <Button label="Confirm my email" pending={pending} onPress={confirm} />
        </>
      ) : (
        <>
          <TextField
            label="Full name"
            value={fields.name}
            onChangeText={(value) => set("name", value)}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextField
            label="Email"
            value={fields.email}
            onChangeText={(value) => set("email", value)}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <TextField
            label="Nearest city"
            value={fields.city}
            onChangeText={(value) => set("city", value)}
            autoCapitalize="words"
            autoComplete="off"
            hint="Charlotte, Atlanta or Houston."
          />
          <Button label="Send my application" pending={pending} onPress={apply} />
        </>
      )}
    </View>
  );
}

function DemoSignUp() {
  const router = useRouter();
  const { setDemoState } = useSession();

  return (
    <Button
      label="Send my application"
      onPress={() => {
        setDemoState("preview");
        router.replace("/onboarding/photo");
      }}
    />
  );
}

/** Membership is reviewed by the house, so this takes an application rather than selling a plan. */
export default function SignUp() {
  return (
    <Screen>
      <PageHeading
        eyebrow="Apply"
        title="Join the Circle"
        subtitle="Membership is reviewed by the house. Tell us who you are and your nearest showroom will be in touch."
      />

      {isAuthLive ? <ClerkSignUp /> : <DemoSignUp />}

      <Section title="What happens next">
        <Panel>
          <Text variant="body" tone="muted">
            A clothier reads every application. Your wardrobe arrives already dressed in the Nyoni capsule and your
            first fourteen days include everything Atelier unlocks. A membership tier above that is set by the house,
            not bought here.
          </Text>
        </Panel>
      </Section>
    </Screen>
  );
}
