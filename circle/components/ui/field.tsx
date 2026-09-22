import { TextInput, View, type TextInputProps } from "react-native";
import { fontFamily, radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";
import { Text } from "./text";

/**
 * A labelled input. 52pt tall, square-cornered like every other control, and the label is a real
 * label: it is read out with the field rather than floating above it as decoration.
 */
export type TextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, ...rest }: TextFieldProps) {
  const surface = useSurface();

  return (
    <View style={{ gap: space.x2 }}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={surface.muted}
        style={{
          minHeight: 52,
          paddingHorizontal: space.x4,
          borderWidth: 1,
          borderColor: surface.controlLine,
          borderRadius: radius.sm,
          color: surface.text,
          fontFamily: fontFamily.ui,
          fontSize: 16,
        }}
      />
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
