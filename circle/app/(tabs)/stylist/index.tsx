import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { OutlinePanel } from "@/components/ui/rows";
import { Text } from "@/components/ui/text";
import { AdvisorBadge } from "@/components/stylist/advisor";
import { ChatComposer, ChatMessage } from "@/components/stylist/chat";
import { OutfitBoard } from "@/components/stylist/outfit-board";
import { conversations, lookById, lookPieceIds, pieceById } from "@/lib/fixtures";
import { relativeDate } from "@/lib/format";
import { space } from "@/lib/theme";

const PROMPTS = [
  "A black-tie wedding. Something with character.",
  "Three days in New York, two dinners and a meeting.",
  "What do I wear to a summer garden party?",
  "Build me a week of work looks from what I own.",
];

/**
 * The stylist. Free at every tier, because styling advice is the house talking. The advisor badge
 * and the clothier link sit together at the top so a member always knows which of the two they are
 * about to reach.
 */
export default function Stylist() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const look = lookById("look_black_tie");

  const board = look
    ? lookPieceIds(look)
        .map((id) => pieceById(id))
        .filter(Boolean)
        .slice(0, 3)
        .map((piece) => ({
          id: piece!.id,
          productId: piece!.productId,
          name: piece!.name,
          owned: piece!.source === "owned",
        }))
    : [];

  return (
    <Screen>
      <PageHeading
        title="The Nyoni stylist"
        action={<TextAction label="Speak to a clothier" onPress={() => router.push("/circle/clothier")} />}
      />
      <AdvisorBadge />

      <Section>
        <View style={{ gap: space.x3 }}>
          <ChatMessage from="member">A black-tie wedding. Something with character.</ChatMessage>
          <ChatMessage from="advisor">Midnight tailoring, a crisp white shirt and your black loafers.</ChatMessage>
        </View>
      </Section>

      {board.length > 0 ? (
        <Section>
          <OutfitBoard title="Your evening, considered." pieces={board} />
          <Button label="Try this look" onPress={() => router.push("/try-on")} />
          <Button
            label="Shop missing pieces"
            variant="secondary"
            onPress={() => router.push({ pathname: "/looks/[lookId]", params: { lookId: "look_black_tie" } })}
          />
        </Section>
      ) : null}

      <Section title="Try asking">
        <View style={{ gap: space.x2 }}>
          {PROMPTS.map((prompt) => (
            <OutlinePanel key={prompt}>
              <TextAction
                label={prompt}
                arrow={false}
                onPress={() => router.push({ pathname: "/stylist/[chatId]", params: { chatId: "new" } })}
              />
            </OutlinePanel>
          ))}
        </View>
      </Section>

      <Section title="Your conversations" major>
        <View style={{ gap: space.x3 }}>
          {conversations.map((conversation) => (
            <OutlinePanel key={conversation.id}>
              <Text variant="productTitle">{conversation.title}</Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {conversation.preview}
              </Text>
              <TextAction
                label={`Open · ${relativeDate(conversation.lastMessageAt)}`}
                onPress={() => router.push({ pathname: "/stylist/[chatId]", params: { chatId: conversation.id } })}
              />
            </OutlinePanel>
          ))}
        </View>
      </Section>

      <Section>
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={() => {
            setDraft("");
            router.push({ pathname: "/stylist/[chatId]", params: { chatId: "new" } });
          }}
          placeholder="What are you dressing for?"
        />
      </Section>
    </Screen>
  );
}
