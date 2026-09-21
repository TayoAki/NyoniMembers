import { Pressable, TextInput, View } from "react-native";
import { chrome, fontFamily, ny, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";
import { Icon } from "@/components/ui/icons";
import { Text } from "@/components/ui/text";

/**
 * The member's words sit right on a cool grey; the advisor's sit left on warm white. Both stop at
 * 85% of the width so neither runs edge to edge, and the bubbles are the one place besides the
 * composer where this app uses a large radius.
 */
export function ChatMessage({ from, children }: { from: "member" | "advisor"; children: React.ReactNode }) {
  const fromMember = from === "member";
  return (
    <View
      style={{
        maxWidth: "85%",
        alignSelf: fromMember ? "flex-end" : "flex-start",
        padding: space.x4,
        borderRadius: radius.chat,
        backgroundColor: fromMember ? ny.chatUser : ny.paper,
      }}
    >
      <Text variant="body" style={{ color: ny.ink }}>
        {children}
      </Text>
    </View>
  );
}

/** A rounded outline with a visible prompt and a 44pt send target that grows with the text. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
}) {
  const surface = useSurface();
  const ready = value.trim().length > 0;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.x2,
        paddingHorizontal: space.x4,
        paddingVertical: space.x2,
        borderWidth: 1,
        borderColor: surface.controlLine,
        borderRadius: radius.pill,
        backgroundColor: surface.background,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={surface.muted}
        multiline
        accessibilityLabel="What are you dressing for?"
        style={{
          flex: 1,
          minHeight: chrome.tapTarget - space.x2,
          maxHeight: 120,
          paddingTop: space.x3,
          paddingBottom: space.x3,
          color: surface.text,
          fontFamily: fontFamily.ui,
          fontSize: 16,
          lineHeight: 22,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={onSend}
        style={({ pressed }) => ({
          width: chrome.tapTarget,
          height: chrome.tapTarget,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          backgroundColor: ready ? surface.text : "transparent",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Icon name="send" size={20} colour={ready ? surface.background : surface.muted} />
      </Pressable>
    </View>
  );
}
