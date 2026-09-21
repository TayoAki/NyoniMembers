import { View } from "react-native";
import { fontFamily, ny, space } from "@/lib/theme";
import { Text } from "./text";

/**
 * A temporary text lockup, clearly identified as such: NYONI over a spaced COUTURE, set in the
 * house's own Bodoni. The style guide asks for the approved vector when it arrives; until then this
 * stands in and is deliberately not a reconstruction of the trademark letter by letter.
 *
 * One accessible name, "Nyoni Couture", even though the artwork has two lines.
 */
export function Wordmark({ size = "header", onDark = true }: { size?: "header" | "large"; onDark?: boolean }) {
  const scale = size === "large" ? 34 : 22;
  const colour = onDark ? ny.ivory : ny.ink;
  const subdued = onDark ? ny.darkMuted : ny.muted;

  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Nyoni Couture" style={{ alignItems: "center" }}>
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: scale,
          lineHeight: scale * 1.08,
          letterSpacing: scale * 0.17,
          // The tracking pushes the block right; pull it back so it optically centres.
          marginRight: -scale * 0.17,
          color: colour,
        }}
      >
        NYONI
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.ui,
          fontSize: Math.max(7, scale * 0.28),
          lineHeight: Math.max(9, scale * 0.34),
          letterSpacing: scale * 0.26,
          marginRight: -scale * 0.26,
          marginTop: space.x1 / 2,
          color: subdued,
        }}
      >
        COUTURE
      </Text>
    </View>
  );
}
