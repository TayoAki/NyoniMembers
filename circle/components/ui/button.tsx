import { ActivityIndicator, Pressable, View, type PressableProps, type ViewStyle } from "react-native";
import { hitSize, radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  /** Shows a spinner in place of the label and blocks presses. */
  pending?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  pending = false,
  full = true,
  icon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const colours = useColours();
  const isDisabled = disabled || pending;

  const surface: Record<Variant, { background: string; border: string; tone: "default" | "onPrimary" | "danger" }> = {
    primary: { background: colours.primary, border: colours.primary, tone: "onPrimary" },
    secondary: { background: "transparent", border: colours.borderStrong, tone: "default" },
    ghost: { background: "transparent", border: "transparent", tone: "default" },
    danger: { background: "transparent", border: colours.danger, tone: "danger" },
  };
  const { background, border, tone } = surface[variant];

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: pending }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minHeight: size === "lg" ? 56 : hitSize.min,
          alignSelf: full ? "stretch" : "flex-start",
          paddingHorizontal: space.xl,
          paddingVertical: size === "lg" ? space.lg : space.md,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={variant === "primary" ? colours.onPrimary : colours.foreground} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text variant="label" tone={tone}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
