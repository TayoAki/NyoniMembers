import { Pressable, View, type ViewStyle } from "react-native";
import { chrome, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";
import { Icon } from "./icons";
import { Text } from "./text";

/** A navigable row with a thin divider and a chevron, at least 48pt high. */
export function ServiceRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  const surface = useSurface();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: chrome.buttonHeight,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.x3,
        paddingVertical: space.x3,
        borderBottomWidth: 1,
        borderBottomColor: surface.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="body">{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.x2 }}>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
        <Icon name="forward" size={18} colour={surface.muted} />
      </View>
    </Pressable>
  );
}

/** A label and a value. Used for attributes, totals and anything tabular. */
export function DetailRow({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.x4 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="caption" tone={tone ?? "default"} style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

/** A quiet inset panel. 8pt of rounding, which is the only place this app rounds more than 3. */
export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const surface = useSurface();
  return (
    <View
      style={[
        {
          padding: space.x4,
          gap: space.x3,
          borderRadius: radius.card,
          backgroundColor: surface.well,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** An outlined panel, for when a block needs a boundary rather than a fill. */
export function OutlinePanel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const surface = useSurface();
  return (
    <View
      style={[
        {
          padding: space.x4,
          gap: space.x3,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: surface.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
