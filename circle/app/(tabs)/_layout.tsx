import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/** Five tabs, the shape of the product: find something, style it, see it, ask, keep it. */
export default function TabsLayout() {
  const colours = useColours();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useSession();

  if (!isSignedIn) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colours.primary,
        tabBarInactiveTintColor: colours.muted,
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          backgroundColor: colours.background,
          borderTopColor: colours.border,
          // The label sits under the icon, so the bar needs room for both plus the home indicator.
          height: 64 + insets.bottom,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.xs,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarLabelStyle: {
          fontFamily: "IBMPlexMono_400Regular",
          fontSize: 10,
          lineHeight: 14,
          letterSpacing: 0.6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="drops"
        options={{
          title: "Drops",
          tabBarIcon: ({ color, size }) => <Ionicons name="diamond-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="try-on"
        options={{
          title: "Try-on",
          tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="concierge"
        options={{
          title: "Concierge",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color, size }) => <Ionicons name="shirt-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
