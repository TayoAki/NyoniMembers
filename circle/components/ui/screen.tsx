import type { ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, surfaces, type SurfaceTone } from "@/lib/theme";
import { SurfaceProvider, useGutter, useSurface } from "@/lib/use-theme";
import { Text } from "./text";

/**
 * A page. It owns the surface tone, the side gutter and the space the bottom navigation needs, so
 * no screen has to reserve that itself and no last action ends up under the bar.
 */
export function Screen({
  children,
  tone = "light",
  scroll = true,
  gutter = true,
  footer,
  style,
}: {
  children: ReactNode;
  tone?: SurfaceTone;
  scroll?: boolean;
  /** Off for full-bleed pages such as the home hero, which pad their own content. */
  gutter?: boolean;
  /** Pinned above the safe area for one primary action. */
  footer?: ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const gutterWidth = useGutter();
  const surface = surfaces[tone];
  const padding: ViewStyle = { paddingHorizontal: gutter ? gutterWidth : 0 };
  const bottom = Math.max(insets.bottom, space.x4);

  return (
    <SurfaceProvider tone={tone}>
      <View style={{ flex: 1, backgroundColor: surface.background }}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[padding, { paddingBottom: space.x10 + bottom }, style]}
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
              paddingHorizontal: gutterWidth,
              paddingTop: space.x4,
              paddingBottom: bottom,
              borderTopWidth: 1,
              borderTopColor: surface.line,
              backgroundColor: surface.background,
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </SurfaceProvider>
  );
}

/** One H1 per screen: a serif title, an optional subtitle, an optional action beside it. */
export function PageHeading({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ paddingTop: space.x6, paddingBottom: space.x5, gap: space.x2 }}>
      {eyebrow ? (
        <Text variant="eyebrow" tone="accent">
          {eyebrow}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.x4 }}>
        <Text variant="pageTitle" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {subtitle ? (
        <Text variant="body" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** A titled block. 24–32pt above it; 40 between major stories, which callers pass as `major`. */
export function Section({
  title,
  action,
  children,
  major = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  major?: boolean;
}) {
  return (
    <View style={{ gap: space.x4, paddingTop: major ? space.x10 : space.x6 }}>
      {title || action ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.x3 }}>
          {title ? (
            <Text variant="section" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </Text>
          ) : null}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A hairline rule. Decorative only: control boundaries use `controlLine`. */
export function Divider() {
  const surface = useSurface();
  return <View style={{ height: 1, backgroundColor: surface.line }} />;
}
