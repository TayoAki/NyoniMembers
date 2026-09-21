import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, TextAction } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AdvisorBadge } from "@/components/stylist/advisor";
import { ChatComposer, ChatMessage } from "@/components/stylist/chat";
import { OutfitBoard } from "@/components/stylist/outfit-board";
import { lookPieceIds, messagesByConversation, pieceById } from "@/lib/fixtures";
import { ny, space } from "@/lib/theme";
import { SurfaceProvider, useGutter } from "@/lib/use-theme";
import type { Look } from "@/lib/types";

/**
 * A conversation. The composer stays above the keyboard and the thread scrolls behind it, which is
 * the part of a chat screen that is usually wrong on a phone.
 */
export default function Chat() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const [draft, setDraft] = useState("");
  const messages = messagesByConversation[chatId] ?? [];

  return (
    <SurfaceProvider tone="light">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: ny.ivory }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 64}
      >
        <ScrollView
          contentContainerStyle={{ padding: gutter, gap: space.x4, paddingBottom: space.x8 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.x3 }}>
            <AdvisorBadge />
            <TextAction label="Speak to a clothier" onPress={() => router.push("/circle/clothier")} />
          </View>

          {messages.length === 0 ? (
            <View style={{ paddingTop: space.x6, gap: space.x3 }}>
              <Text variant="pageTitle" accessibilityRole="header">
                What are you dressing for?
              </Text>
              <Text variant="body" tone="muted">
                Tell the stylist the occasion, the city and the time of day. It reads your wardrobe before it answers,
                and it will only name pieces you actually have.
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <View key={message.id} style={{ gap: space.x3 }}>
                <ChatMessage from={message.role === "member" ? "member" : "advisor"}>{message.body}</ChatMessage>
                {message.proposedLook ? (
                  <Proposal look={message.proposedLook} onSave={() => router.push("/wardrobe")} />
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: gutter,
            paddingTop: space.x3,
            paddingBottom: Math.max(insets.bottom, space.x3),
            borderTopWidth: 1,
            borderTopColor: ny.line,
          }}
        >
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={() => setDraft("")}
            placeholder="What are you dressing for?"
          />
        </View>
      </KeyboardAvoidingView>
    </SurfaceProvider>
  );
}

function Proposal({ look, onSave }: { look: Look; onSave: () => void }) {
  const pieces = lookPieceIds(look)
    .map((id) => pieceById(id))
    .filter(Boolean)
    .slice(0, 3)
    .map((piece) => ({
      id: piece!.id,
      productId: piece!.productId,
      name: piece!.name,
      owned: piece!.source === "owned",
    }));

  return (
    <View style={{ gap: space.x3 }}>
      <OutfitBoard title={look.title} pieces={pieces} />
      <Button label="Save to your looks" variant="secondary" onPress={onSave} />
    </View>
  );
}
