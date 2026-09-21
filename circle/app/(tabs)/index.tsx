import { useRouter } from "expo-router";
import { View } from "react-native";
import { TextAction } from "@/components/ui/button";
import { EditorialHero } from "@/components/ui/editorial";
import { ImageWell } from "@/components/ui/product";
import { Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { appointments, drops, showroomById, suitEntitlement } from "@/lib/fixtures";
import { relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, space } from "@/lib/theme";
import { useGutter, useSurface } from "@/lib/use-theme";

const SUIT_STATUS: Record<string, string> = {
  available: "Ready to begin",
  booked: "Fitting booked",
  in_progress: "In the workroom",
  delivered: "Delivered",
};

/**
 * Home is one editorial image and one next action. The hero text sits in normal flow beneath the
 * photograph rather than at fixed coordinates, so nothing collides when a line wraps or the type
 * grows.
 */
export default function Home() {
  const router = useRouter();
  const drop = drops.find((entry) => entry.state === "available");

  return (
    <Screen gutter={false}>
      {drop ? (
        <EditorialHero
          productId={drop.heroPieceId}
          eyebrow="Welcome to the Circle"
          title={"Style, on\nyour terms."}
          caption="The private edit"
          actionLabel="Discover the collection"
          onAction={() => router.push({ pathname: "/drops/[dropId]", params: { dropId: drop.id } })}
        />
      ) : null}

      <AnnualSuitCard />

      <View style={{ paddingHorizontal: useGutter() }}>
        <Section title="Where to begin">
          <Text variant="body" tone="muted">
            Ask the stylist what to wear, or open the wardrobe the house has already dressed for you.
          </Text>
          <TextAction label="Ask the Nyoni stylist" onPress={() => router.push("/stylist")} />
        </Section>
      </View>
    </Screen>
  );
}

/** A compact card: fabric thumbnail, serif title, status with a dot and words, and the booking link. */
function AnnualSuitCard() {
  const router = useRouter();
  const surface = useSurface();
  const gutter = useGutter();
  const { atLeast } = useSession();
  const appointment = appointments.find((entry) => entry.id === suitEntitlement.appointmentId);

  if (!atLeast("signature")) return null;

  return (
    <View style={{ paddingHorizontal: gutter, paddingTop: space.x5 }}>
      <View
        style={{
          flexDirection: "row",
          gap: space.x4,
          padding: space.x4,
          borderRadius: radius.card,
          backgroundColor: surface.well,
          alignItems: "center",
        }}
      >
        <ImageWell productId="nyoni-grayson" label="Your cloth" isolated style={{ width: 64 }} />
        <View style={{ flex: 1, gap: space.x1 }}>
          <Text variant="section">Your annual suit</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.x2 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: surface.accent }}
            />
            <Text variant="caption" tone="muted">
              {SUIT_STATUS[suitEntitlement.status] ?? "Ready to begin"}
              {appointment
                ? ` · ${showroomById(appointment.showroomId)?.city ?? ""} ${relativeDate(appointment.requestedFor)}`
                : ""}
            </Text>
          </View>
          <TextAction
            label={appointment ? "See your fitting" : "Book your fitting"}
            onPress={() => router.push("/circle/suit")}
          />
        </View>
      </View>
    </View>
  );
}
