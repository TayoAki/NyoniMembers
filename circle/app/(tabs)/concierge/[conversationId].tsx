import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Text } from "@/components/ui/text";
import { messagesByConversation } from "@/lib/fixtures";
import { space, radius } from "@/lib/theme";
import type { Message } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

/**
 * The chat. Streaming is wired in M9; here the thread is fixture-backed and the composer is real
 * enough to check the keyboard behaviour, which is the thing that usually goes wrong on a phone.
 */
export default function Conversation() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const colours = useColours();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const messages = messagesByConversation[conversationId] ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colours.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView
        contentContainerStyle={{ padding: space.gutter, gap: space.lg, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={{ paddingTop: space.xxl, gap: space.md }}>
            <Text variant="heading">What are you dressing for?</Text>
            <Text variant="bodySmall" tone="muted">
              Tell the concierge the occasion, the city and the time of day. It reads your wardrobe before it answers,
              and it will only ever name pieces you actually have.
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <Bubble key={message.id} message={message} onSave={() => router.push("/wardrobe")} />
          ))
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: space.sm,
          alignItems: "flex-end",
          paddingHorizontal: space.gutter,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.md),
          borderTopWidth: 1,
          borderTopColor: colours.border,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="What are you dressing for?"
          placeholderTextColor={colours.muted}
          multiline
          accessibilityLabel="Message the concierge"
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: space.md,
            borderWidth: 1,
            borderColor: colours.border,
            borderRadius: radius.lg,
            color: colours.foreground,
            fontFamily: "Manrope_400Regular",
            fontSize: 16,
          }}
        />
        <Button label="Send" full={false} disabled={draft.trim().length === 0} onPress={() => setDraft("")} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, onSave }: { message: Message; onSave: () => void }) {
  const colours = useColours();
  const fromMember = message.role === "member";

  return (
    <View style={{ gap: space.sm, alignItems: fromMember ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "88%",
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: fromMember ? colours.surfaceRaised : colours.surface,
          borderWidth: fromMember ? 0 : 1,
          borderColor: colours.border,
        }}
      >
        {!fromMember ? (
          <Text variant="eyebrow" tone="primary" style={{ marginBottom: space.xs }}>
            The concierge
          </Text>
        ) : null}
        <Text variant="body">{message.body}</Text>
      </View>

      {message.proposedLook ? (
        <Card style={{ width: "88%" }}>
          <Text variant="eyebrow" tone="primary">
            A look for you
          </Text>
          <Text variant="subheading">{message.proposedLook.title}</Text>
          <Button label="Save to your looks" variant="secondary" onPress={onSave} />
        </Card>
      ) : null}
    </View>
  );
}
