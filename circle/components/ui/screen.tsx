import type { ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";
import { Text } from "./text";

/**
 * Every screen sits inside this: the house background, the 16pt side gutter, and safe areas honoured
 * at the bottom so a tab bar or a home indicator never covers the last row of content.
 */
export function Screen({
  children,
  scroll = true,
  gutter = true,
  style,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Off for full-bleed screens such as the fitting room, which manage their own padding. */
  gutter?: boolean;
  style?: ViewStyle;
  /** Pinned above the safe area, for a single primary action such as Checkout. */
  footer?: ReactNode;
}) {
  const colours = useColours();
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = { paddingHorizontal: gutter ? space.gutter : 0 };
  const bottomInset = Math.max(insets.bottom, space.lg);

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[padding, { paddingBottom: space.xxxl + bottomInset }, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, style]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingTop: space.lg,
            paddingBottom: bottomInset,
            borderTopWidth: 1,
            borderTopColor: colours.border,
            backgroundColor: colours.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** The page title block: a mono eyebrow, a Bodoni title, and an optional line of prose. */
export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ paddingTop: space.xl, paddingBottom: space.lg, gap: space.sm }}>
      {eyebrow ? (
        <Text variant="eyebrow" tone="muted">
          {eyebrow}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.lg }}>
        <Text variant="title" style={{ flex: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {description ? (
        <Text variant="bodySmall" tone="muted">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
