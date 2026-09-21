import { ActivityIndicator, Pressable, View, type PressableProps, type ViewStyle } from "react-native";
import { chrome, ny, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";
import { Icon } from "./icons";
import { Text } from "./text";

/**
 * Four fills and one link, per the style guide. Controls are square: 3pt of rounding, not a pill.
 * Nothing here is smaller than 48pt high, and a disabled button keeps its width so a pending state
 * never shifts the layout under a thumb.
 */
export type ButtonVariant = "primary" | "secondary" | "ivory" | "gold";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  pending?: boolean;
  full?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  pending = false,
  full = true,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const surface = useSurface();
  const busy = disabled || pending;

  const fills: Record<ButtonVariant, { background: string; border: string; label: string }> = {
    primary: { background: surface.text, border: surface.text, label: surface.background },
    secondary: { background: "transparent", border: surface.text, label: surface.text },
    ivory: { background: ny.ivory, border: ny.ivory, label: ny.ink },
    gold: { background: ny.gold, border: ny.gold, label: ny.ink },
  };
  const fill = fills[variant];

  return (
    <Pressable
      {...rest}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(busy), busy: pending }}
      style={({ pressed }) => [
        {
          minHeight: chrome.buttonHeight,
          alignSelf: full ? "stretch" : "flex-start",
          paddingHorizontal: space.x5,
          paddingVertical: space.x3,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: fill.border,
          backgroundColor: fill.background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.x2,
          opacity: busy ? 0.5 : pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={fill.label} />
      ) : (
        <Text variant="button" style={{ color: fill.label }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** An underlined label with an optional arrow. Used for navigation, never for a state change. */
export function TextAction({
  label,
  onPress,
  arrow = true,
  tone = "default",
}: {
  label: string;
  onPress: () => void;
  arrow?: boolean;
  tone?: "default" | "accent" | "inverse";
}) {
  const surface = useSurface();
  const colour = tone === "accent" ? surface.accentText : tone === "inverse" ? surface.background : surface.text;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: chrome.tapTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: space.x2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="button" style={{ color: colour, textDecorationLine: "underline" }}>
        {label}
      </Text>
      {arrow ? (
        <View style={{ marginTop: 1 }}>
          <Icon name="arrow" size={16} colour={colour} />
        </View>
      ) : null}
    </Pressable>
  );
}
