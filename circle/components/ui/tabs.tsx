import { Pressable, ScrollView, View } from "react-native";
import { chrome, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";
import { Text } from "./text";

/**
 * Content tabs sit on a fine rule: the active one is ink with a 2pt underline, the rest are muted.
 * Selection is never colour alone. The strip scrolls sideways when the labels grow, which is the
 * one place this app allows horizontal scrolling.
 */
export function ContentTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const surface = useSurface();

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: surface.line }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={label}
      >
        <View style={{ flexDirection: "row", gap: space.x6 }}>
          {tabs.map((tab) => {
            const active = tab.value === value;
            return (
              <Pressable
                key={tab.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
                onPress={() => onChange(tab.value)}
                style={{
                  minHeight: chrome.tapTarget,
                  justifyContent: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: active ? surface.text : "transparent",
                  marginBottom: -1,
                }}
              >
                <Text variant="button" tone={active ? "default" : "muted"}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** Filter chips, square-cornered like every other control here. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const surface = useSurface();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x2 }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: chrome.tapTarget,
              justifyContent: "center",
              paddingHorizontal: space.x4,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: active ? surface.text : surface.controlLine,
              backgroundColor: active ? surface.text : "transparent",
            }}
          >
            <Text variant="caption" style={{ color: active ? surface.background : surface.muted }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
