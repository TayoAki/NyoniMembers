import { ActivityIndicator, View } from "react-native";
import { radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * The non-ideal states the style guide requires, as components, so they read the same everywhere.
 * Each one is calm, names what happened, and offers the way out.
 */

export function LoadingState({ label }: { label: string }) {
  const surface = useSurface();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{ paddingVertical: space.x10, alignItems: "center", gap: space.x3 }}
    >
      <ActivityIndicator color={surface.accentText} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/** A placeholder that holds the ratio of what is coming, so nothing jumps when it arrives. */
export function Skeleton({ aspect, height, style }: { aspect?: number; height?: number; style?: object }) {
  const surface = useSurface();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { borderRadius: radius.sm, backgroundColor: surface.well },
        aspect ? { aspectRatio: aspect } : { height: height ?? 16 },
        style,
      ]}
    />
  );
}

export function EmptyState({
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
  const surface = useSurface();
  return (
    <View
      style={{
        paddingVertical: space.x8,
        paddingHorizontal: space.x5,
        gap: space.x3,
        alignItems: "center",
        borderWidth: 1,
        borderColor: surface.line,
        borderRadius: radius.sm,
      }}
    >
      <Text variant="section" center>
        {title}
      </Text>
      <Text variant="body" tone="muted" center>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ paddingTop: space.x2, alignSelf: "stretch" }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/** An inline notice. `tone` sets the semantics; the icon word carries them too, never colour alone. */
export function InlineNotice({
  tone = "info",
  title,
  description,
  actionLabel,
  onAction,
}: {
  tone?: "info" | "error" | "success";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const surface = useSurface();
  const colour = tone === "error" ? surface.error : tone === "success" ? surface.success : surface.controlLine;

  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "summary"}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={{
        padding: space.x4,
        gap: space.x2,
        borderWidth: 1,
        borderColor: colour,
        borderRadius: radius.sm,
      }}
    >
      <Text variant="button" style={{ color: tone === "info" ? surface.text : colour }}>
        {title}
      </Text>
      {description ? (
        <Text variant="caption" tone="muted">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ paddingTop: space.x1 }}>
          <Button label={actionLabel} variant="secondary" onPress={onAction} full={false} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A restricted feature. It explains the eligibility, names the price and the period, and routes to
 * membership. It never dead-ends and it never hides what the thing costs.
 */
export function LockedState({
  title,
  description,
  priceLine,
  actionLabel,
  onAction,
  compact = false,
}: {
  title: string;
  description: string;
  priceLine: string;
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
}) {
  const surface = useSurface();
  return (
    <View
      style={{
        padding: compact ? space.x4 : space.x5,
        gap: space.x3,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: surface.controlLine,
        backgroundColor: surface.well,
      }}
    >
      <Text variant="eyebrow" tone="accent">
        Atelier
      </Text>
      <Text variant="section">{title}</Text>
      <Text variant="body" tone="muted">
        {description}
      </Text>
      <Text variant="caption" tone="muted">
        {priceLine}
      </Text>
      <Button label={actionLabel} onPress={onAction} />
    </View>
  );
}
