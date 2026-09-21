import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chrome, ny, space } from "@/lib/theme";
import { SurfaceProvider, useGutter } from "@/lib/use-theme";
import { Icon } from "./icons";
import { Wordmark } from "./wordmark";

/**
 * The black bar every screen sits under: the wordmark links Home, the profile control opens
 * membership. Both are 44pt targets even though the artwork is smaller, and the profile icon is
 * deliberately not the Stylist figure from the navigation.
 */
export function BrandHeader({ canGoBack = false }: { canGoBack?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();

  return (
    <SurfaceProvider tone="dark">
      <View
        style={{
          backgroundColor: ny.ink,
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: ny.darkLine,
        }}
      >
        <View
          style={{
            minHeight: chrome.headerHeight,
            paddingHorizontal: gutter,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.x4,
          }}
        >
          <View style={{ width: chrome.tapTarget, alignItems: "flex-start" }}>
            {canGoBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                hitSlop={space.x3}
                style={({ pressed }) => ({
                  width: chrome.tapTarget,
                  height: chrome.tapTarget,
                  justifyContent: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon name="back" size={24} colour={ny.ivory} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Nyoni Couture, go to Home"
            onPress={() => router.push("/(tabs)")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Wordmark />
          </Pressable>

          <View style={{ width: chrome.tapTarget, alignItems: "flex-end" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open membership"
              onPress={() => router.push("/circle")}
              hitSlop={space.x3}
              style={({ pressed }) => ({
                width: chrome.tapTarget,
                height: chrome.tapTarget,
                alignItems: "flex-end",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="account" size={26} colour={ny.ivory} />
            </Pressable>
          </View>
        </View>
      </View>
    </SurfaceProvider>
  );
}
