import { useRouter } from "expo-router";
import { Linking, View } from "react-native";
import { Button, TextAction } from "@/components/ui/button";
import { ConciergeCard } from "@/components/circle/concierge-card";
import { DetailRow, OutlinePanel } from "@/components/ui/rows";
import { PageHeading, Screen, Section } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { showrooms } from "@/lib/fixtures";
import { space } from "@/lib/theme";

const HOUSE_EMAIL = "info@nyonicouture.com";
const HOUSE_SMS = "+19802372331";

/** The human channel. Always reachable, never behind a paywall, never confused with the stylist. */
export default function Clothier() {
  const router = useRouter();

  return (
    <Screen>
      <PageHeading
        eyebrow="The house"
        title="Your clothier"
        subtitle="For a fitting, an alteration, a commission or anything the app cannot settle."
      />

      <ConciergeCard
        name="The Nyoni house"
        blurb="Messages are answered within one working day. For something urgent, call the showroom."
        onContact={() => void Linking.openURL(`mailto:${HOUSE_EMAIL}`)}
      />

      <Section>
        <Button label="Send a message" onPress={() => void Linking.openURL(`mailto:${HOUSE_EMAIL}`)} />
        <Button label="Text the house" variant="secondary" onPress={() => void Linking.openURL(`sms:${HOUSE_SMS}`)} />
      </Section>

      <Section title="The showrooms">
        <View style={{ gap: space.x3 }}>
          {showrooms.map((room) => (
            <OutlinePanel key={room.id}>
              <Text variant="section">{room.city}</Text>
              <Text variant="body" tone="muted">
                {room.address}
              </Text>
              <DetailRow label="Hours" value={room.hours} />
              <TextAction
                label={`Call ${room.phone}`}
                arrow={false}
                onPress={() => void Linking.openURL(`tel:${room.phone.replace(/[^0-9+]/g, "")}`)}
              />
            </OutlinePanel>
          ))}
        </View>
      </Section>

      <Section>
        <Button label="Book an appointment" onPress={() => router.push("/circle/appointments")} />
      </Section>

      <Section>
        <Text variant="caption" tone="muted">
          The Nyoni stylist in the app answers styling questions from your wardrobe. Your clothier is a person, and
          settles anything to do with fit, cloth, commissions or your membership.
        </Text>
      </Section>
    </Screen>
  );
}
