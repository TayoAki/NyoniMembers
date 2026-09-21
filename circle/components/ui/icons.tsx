import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

/**
 * One icon family at one weight. Ionicons' outline set is a coherent 1.5pt-stroke family at 24pt,
 * which is what the style guide asks for; the names below are the guide's icon concepts, kept in
 * one place so a screen never reaches for an unrelated glyph.
 */
type IoniconName = ComponentProps<typeof Ionicons>["name"];

export const icon = {
  home: "home-outline",
  drops: "pricetag-outline",
  tryOn: "scan-outline",
  stylist: "person-outline",
  wardrobe: "briefcase-outline",
  account: "person-circle-outline",
  back: "chevron-back",
  forward: "chevron-forward",
  arrow: "arrow-forward",
  send: "arrow-up",
  camera: "camera-outline",
  library: "images-outline",
  add: "add",
  close: "close",
  check: "checkmark",
} satisfies Record<string, IoniconName>;

export type IconName = keyof typeof icon;

export function Icon({ name, size = 24, colour }: { name: IconName; size?: number; colour: ColorValue }) {
  return <Ionicons name={icon[name]} size={size} color={colour} />;
}
