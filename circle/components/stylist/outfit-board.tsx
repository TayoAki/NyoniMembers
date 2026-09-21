import { View } from "react-native";
import { ImageWell } from "@/components/ui/product";
import { Text } from "@/components/ui/text";
import { radius, space } from "@/lib/theme";
import { useSurface } from "@/lib/use-theme";

export type BoardPiece = { id: string; productId?: string; name: string; owned: boolean };

/**
 * The advisor's proposal, laid out as a board: a serif title, the garments across it, and each one
 * labelled with where it comes from. A member must be able to see which pieces are theirs already
 * and which are the house's before anything is bought.
 */
export function OutfitBoard({ title, pieces }: { title: string; pieces: BoardPiece[] }) {
  const surface = useSurface();
  const columns = pieces.length >= 3 ? 3 : pieces.length;

  return (
    <View
      style={{
        padding: space.x4,
        gap: space.x4,
        borderRadius: radius.card,
        backgroundColor: surface.well,
      }}
    >
      <Text variant="section" center accessibilityRole="header">
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.x3, justifyContent: "center" }}>
        {pieces.map((piece) => (
          <View key={piece.id} style={{ width: `${100 / columns - 4}%`, minWidth: 88, gap: space.x2 }}>
            <ImageWell productId={piece.productId} label={piece.name} isolated />
            <View style={{ gap: 2 }}>
              <Text variant="eyebrow" tone={piece.owned ? "muted" : "accent"}>
                {piece.owned ? "You own" : "Nyoni"}
              </Text>
              <Text variant="caption" numberOfLines={2}>
                {piece.name}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
