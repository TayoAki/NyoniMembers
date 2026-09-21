import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, ProductCard, Row } from "@/components/ui/cards";
import { Photo } from "@/components/ui/photo";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { Wordmark } from "@/components/ui/wordmark";
import { appointments, drops, looks, productById, showroomById, suitEntitlement } from "@/lib/fixtures";
import { relativeDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { radius, ratio, space } from "@/lib/theme";
import { TIER_LABELS } from "@/lib/types";
import { useColours } from "@/lib/use-theme";

const SUIT_STATUS: Record<string, string> = {
  available: "Ready to begin",
  booked: "Fitting booked",
  in_progress: "In the workroom",
  delivered: "Delivered",
};

/** The editorial front page: who you are, what the house has for you, and what you left unfinished. */
export default function Home() {
  const colours = useColours();
  const router = useRouter();
  const { member, tier, hasAtelier, atelierSource, previewDaysLeft } = useSession();
  const drop = drops.find((entry) => entry.state === "available");
  const appointment = appointments.find((entry) => entry.status === "confirmed");
  const recentLook = looks[looks.length - 1];

  return (
    <Screen>
      <View
        style={{
          paddingTop: space.xxl,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark size="sm" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your account"
          onPress={() => router.push("/circle")}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colours.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="eyebrow">{member?.initials ?? "—"}</Text>
        </Pressable>
      </View>

      <View style={{ paddingTop: space.xxl, gap: space.md }}>
        <Text variant="eyebrow" tone="primary">
          Welcome to the Circle
        </Text>
        <Text variant="display">Style, on your terms.</Text>
        <Text variant="bodySmall" tone="muted">
          {TIER_LABELS[tier]} member
          {atelierSource === "preview"
            ? ` · Atelier preview, ${previewDaysLeft} days left`
            : hasAtelier
              ? " · Atelier included"
              : ""}
        </Text>
      </View>

      {drop ? (
        <Section title="The private edit" eyebrow="Available now">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open the drop, ${drop.title}`}
            onPress={() => router.push({ pathname: "/drops/[dropId]", params: { dropId: drop.id } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, gap: space.md })}
          >
            <Photo productId={drop.heroPieceId} fallbackLabel={drop.title} aspect={ratio.hero} contentFit="cover" />
            <View style={{ gap: space.xs }}>
              <Text variant="heading">{drop.title}</Text>
              <Text variant="bodySmall" tone="muted">
                {drop.subtitle}
              </Text>
            </View>
          </Pressable>
        </Section>
      ) : null}

      <Section title="Your annual suit">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Ionicons name="ellipse" size={10} color={colours.primary} />
            <Text variant="label">{SUIT_STATUS[suitEntitlement.status] ?? "Ready to begin"}</Text>
          </View>
          {appointment ? (
            <Row
              label={`${showroomById(appointment.showroomId)?.city ?? "Showroom"} fitting`}
              value={relativeDate(appointment.requestedFor)}
            />
          ) : null}
          <Button
            label={appointment ? "See the appointment" : "Book your fitting"}
            variant="secondary"
            onPress={() => router.push("/circle/suit")}
          />
        </Card>
      </Section>

      {recentLook ? (
        <Section title="Pick up where you left off">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open the look, ${recentLook.title}`}
            onPress={() => router.push({ pathname: "/looks/[lookId]", params: { lookId: recentLook.id } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card>
              <Text variant="eyebrow" tone="muted">
                {recentLook.occasion ?? "A look"}
              </Text>
              <Text variant="heading">{recentLook.title}</Text>
              <Text variant="bodySmall" tone="muted">
                Saved {relativeDate(recentLook.createdAt)}
              </Text>
            </Card>
          </Pressable>
        </Section>
      ) : null}

      {drop ? (
        <Section
          title="From the edit"
          action={
            <Text variant="eyebrow" tone="primary">
              See all
            </Text>
          }
        >
          <View style={{ flexDirection: "row", gap: space.md }}>
            {drop.productIds.slice(0, 2).map((id) => {
              const product = productById(id);
              return product ? <ProductCard key={id} product={product} style={{ flex: 1 }} /> : null;
            })}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
