import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { radius, space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * The four states every screen owes a member, in one component so they always read the same way.
 * `locked` is the fifth and lives in `LockedBlock`, because it needs a price rather than a retry.
 */

export function LoadingBlock({ label }: { label: string }) {
  const colours = useColours();
  return (
    <View style={{ paddingVertical: space.xxxl, alignItems: "center", gap: space.md }} accessibilityRole="progressbar">
      <ActivityIndicator color={colours.primary} />
      <Text variant="bodySmall" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/** A skeleton that matches the shape of what is coming, never a bare spinner on a first load. */
export function SkeletonBlock({ height, style }: { height: number; style?: object }) {
  const colours = useColours();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, borderRadius: radius.md, backgroundColor: colours.surface }, style]}
    />
  );
}

export function EmptyBlock({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colours = useColours();
  return (
    <View
      style={{
        paddingVertical: space.xxl,
        paddingHorizontal: space.xl,
        gap: space.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colours.border,
        borderRadius: radius.lg,
      }}
    >
      <Text variant="heading" center>
        {title}
      </Text>
      <Text variant="bodySmall" tone="muted" center>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} full={false} style={{ marginTop: space.sm }} />
      ) : null}
    </View>
  );
}

export function ErrorBlock({
  title = "That did not work",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  const colours = useColours();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: space.lg,
        gap: space.sm,
        borderWidth: 1,
        borderColor: colours.danger,
        borderRadius: radius.lg,
      }}
    >
      <Text variant="subheading" tone="danger">
        {title}
      </Text>
      <Text variant="bodySmall" tone="muted">
        {description}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} full={false} /> : null}
    </View>
  );
}

/** A labelled row of content with a heading above it; the spine of most screens. */
export function Section({
  title,
  action,
  children,
  eyebrow,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.md, paddingTop: space.xl }}>
      {title || eyebrow || action ? (
        <View style={{ gap: space.xs }}>
          {eyebrow ? (
            <Text variant="eyebrow" tone="muted">
              {eyebrow}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
            {title ? (
              <Text variant="heading" style={{ flex: 1 }}>
                {title}
              </Text>
            ) : null}
            {action}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}
