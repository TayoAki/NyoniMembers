import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { typography, type TypeVariant } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

type Tone = "default" | "muted" | "accent" | "inverse" | "success" | "error";

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  center?: boolean;
};

/**
 * The only text component. Variants carry the whole type scale so no screen picks a size, and
 * `tone` resolves against the surface the text is sitting on rather than a global theme.
 */
export function Text({ variant = "body", tone = "default", center, style, ...rest }: TextProps) {
  const surface = useSurface();
  const colour = {
    default: surface.text,
    muted: surface.muted,
    accent: surface.accentText,
    inverse: surface.background,
    success: surface.success,
    error: surface.error,
  }[tone];

  return (
    <RNText {...rest} style={[typography[variant], { color: colour }, center && { textAlign: "center" }, style]} />
  );
}
