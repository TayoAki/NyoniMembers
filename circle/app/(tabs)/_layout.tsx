import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/ui/brand-header";
import { Icon, type IconName } from "@/components/ui/icons";
import { useSession } from "@/lib/session";
import { chrome, ny, space } from "@/lib/theme";

/**
 * Five destinations in the order the style guide fixes them. Membership is not among them: it opens
 * from the header profile control, so no bottom destination is falsely selected on that page.
 *
 * The active destination is gold and carries a short underline, so selection is never colour alone.
 */
const DESTINATIONS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "drops", title: "Drops", icon: "drops" },
  { name: "try-on", title: "Try-on", icon: "tryOn" },
  { name: "stylist", title: "Stylist", icon: "stylist" },
  { name: "wardrobe", title: "Wardrobe", icon: "wardrobe" },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useSession();

  if (!isSignedIn) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        header: () => <BrandHeader />,
        sceneStyle: { backgroundColor: ny.ivory },
        tabBarActiveTintColor: ny.gold,
        tabBarInactiveTintColor: ny.ivory,
        tabBarStyle: {
          backgroundColor: ny.ink,
          borderTopColor: ny.darkLine,
          height: chrome.navHeight + insets.bottom,
          paddingTop: space.x2,
          paddingBottom: insets.bottom + space.x1,
        },
        tabBarLabelStyle: { fontFamily: "Manrope_500Medium", fontSize: 12, lineHeight: 14 },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      {DESTINATIONS.map((destination) => (
        <Tabs.Screen
          key={destination.name}
          name={destination.name}
          options={{
            title: destination.title,
            // Home has no nested stack, so the tab navigator renders its header; the others
            // render it from their own stack so a pushed screen keeps the same bar.
            headerShown: destination.name === "index",
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", gap: space.x1 }}>
                <Icon name={destination.icon} size={24} colour={color} />
                <View
                  style={{
                    width: 28,
                    height: 2,
                    backgroundColor: focused ? ny.gold : "transparent",
                  }}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
