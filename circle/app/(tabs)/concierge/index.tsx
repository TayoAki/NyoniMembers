import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { EmptyBlock, Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { conversations } from "@/lib/fixtures";
import { relativeDate } from "@/lib/format";
import { space } from "@/lib/theme";

const PROMPTS = [
  "A black-tie wedding. Something with character.",
  "Three days in New York, two dinners and a meeting.",
  "What do I wear to a summer garden party?",
  "Build me a week of work looks from what I own.",
];

/** The concierge is free at every tier: styling advice is the house talking, not a paid feature. */
export default function Concierge() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Ask the house"
        title="Your concierge"
        description="Dressed from your wardrobe, never from thin air. For anything the house itself must do, your clothier takes over."
      />

      <Button
        label="Start a conversation"
        onPress={() => router.push({ pathname: "/concierge/[conversationId]", params: { conversationId: "new" } })}
      />

      <Section title="Try asking">
        <View style={{ gap: space.sm }}>
          {PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              accessibilityRole="button"
              accessibilityLabel={prompt}
              onPress={() =>
                router.push({ pathname: "/concierge/[conversationId]", params: { conversationId: "new" } })
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Card>
                <Text variant="bodySmall">{prompt}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Your conversations">
        {conversations.length === 0 ? (
          <EmptyBlock
            title="Nothing yet"
            description="Ask the concierge what to wear and the conversation is kept here."
          />
        ) : (
          <View style={{ gap: space.md }}>
            {conversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                accessibilityRole="button"
                accessibilityLabel={conversation.title}
                onPress={() =>
                  router.push({ pathname: "/concierge/[conversationId]", params: { conversationId: conversation.id } })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Card>
                  <Text variant="subheading">{conversation.title}</Text>
                  <Text variant="bodySmall" tone="muted" numberOfLines={2}>
                    {conversation.preview}
                  </Text>
                  <Text variant="eyebrow" tone="muted">
                    {relativeDate(conversation.lastMessageAt)}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}
