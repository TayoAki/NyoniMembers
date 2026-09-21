import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { pieceImage } from "@/lib/images";
import { chrome, radius, ratio, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

export type PreviewState = "empty" | "generating" | "ready" | "failed";

/**
 * The image stage. It keeps the same 4:5 frame in every state so nothing jumps between generating
 * and ready, contains the whole figure rather than cropping it, and always carries the caption that
 * says what a member is actually looking at.
 */
export function PreviewStage({ state, productId, label }: { state: PreviewState; productId?: string; label: string }) {
  const surface = useSurface();

  return (
    <View style={{ gap: space.x2 }}>
      <View
        style={{
          aspectRatio: ratio.isolated,
          borderRadius: radius.sm,
          backgroundColor: surface.well,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {state === "ready" && productId ? (
          <Image
            source={pieceImage(productId)}
            contentFit="contain"
            transition={140}
            style={{ width: "100%", height: "100%" }}
            accessibilityIgnoresInvertColors
            alt={`Generated preview of ${label}. A visual preview, not a record of fit.`}
          />
        ) : state === "generating" ? (
          <LoadingState label="Building your preview. This usually takes under a minute." />
        ) : (
          <View style={{ paddingHorizontal: space.x5 }}>
            <Text variant="caption" tone="muted" center>
              {state === "failed" ? "The preview could not be built." : "Choose a look to see it on you."}
            </Text>
          </View>
        )}
      </View>

      {state === "ready" ? (
        <Text variant="caption" tone="muted" center>
          Illustrative preview
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Original and Preview, as an outlined pill with a filled selected segment. Both segments are 44pt
 * high and the frame above never resizes when the selection changes.
 */
export function BeforeAfterControl({
  value,
  onChange,
}: {
  value: "original" | "preview";
  onChange: (value: "original" | "preview") => void;
}) {
  const surface = useSurface();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Show the original photo or the preview"
      style={{
        flexDirection: "row",
        alignSelf: "center",
        padding: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: surface.controlLine,
      }}
    >
      {(["original", "preview"] as const).map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option === "original" ? "Original" : "Preview"}
            onPress={() => onChange(option)}
            style={{
              minHeight: chrome.tapTarget,
              minWidth: 120,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.pill,
              backgroundColor: active ? surface.text : "transparent",
            }}
          >
            <Text variant="button" style={{ color: active ? surface.background : surface.muted }}>
              {option === "original" ? "Original" : "Preview"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
