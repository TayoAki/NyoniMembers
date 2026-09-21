import { View } from "react-native";
import { space } from "@/lib/theme";
import { Text } from "./text";

/**
 * The house wordmark set in Bodoni Moda, with COUTURE spaced beneath it in mono, exactly as it
 * appears on nyonicouture.com. Text rather than an image so it stays crisp at every size and reads
 * correctly to a screen reader.
 */
export function Wordmark({ size = "md", tone }: { size?: "sm" | "md" | "lg"; tone?: "default" | "onPrimary" }) {
  const scale = { sm: 18, md: 26, lg: 34 }[size];
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Nyoni Couture" style={{ alignItems: "center" }}>
      <Text
        variant="title"
        tone={tone}
        style={{ fontSize: scale, lineHeight: scale * 1.1, letterSpacing: scale * 0.16 }}
      >
        NYONI
      </Text>
      <Text
        variant="eyebrow"
        tone={tone ?? "muted"}
        style={{ fontSize: scale * 0.3, letterSpacing: scale * 0.22, marginTop: space.xs }}
      >
        Couture
      </Text>
    </View>
  );
}
