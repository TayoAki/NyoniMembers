import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { useColours } from "@/lib/use-theme";
import { typography, type TypeVariant } from "@/lib/theme";

type Tone = "default" | "muted" | "primary" | "onPrimary" | "danger" | "success" | "warning";

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  /** Centre a single line without a wrapper view. */
  center?: boolean;
};

/**
 * The only text component. Variants carry the house type scale so no screen hand-picks a font size,
 * and Dynamic Type is left switched on so the layout has to survive the accessibility sizes.
 */
export function Text({ variant = "body", tone = "default", center, style, ...rest }: TextProps) {
  const colours = useColours();
  const toneColour = {
    default: colours.foreground,
    muted: colours.muted,
    primary: colours.primary,
    onPrimary: colours.onPrimary,
    danger: colours.danger,
    success: colours.success,
    warning: colours.warning,
  }[tone];

  return (
    <RNText {...rest} style={[typography[variant], { color: toneColour }, center && { textAlign: "center" }, style]} />
  );
}
