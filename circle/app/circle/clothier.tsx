import { useRouter } from "expo-router";
import { Linking, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Section } from "@/components/ui/state-block";
import { Text } from "@/components/ui/text";
import { showrooms } from "@/lib/fixtures";
import { space } from "@/lib/theme";

const CONCIERGE_EMAIL = "info@nyonicouture.com";
const CONCIERGE_SMS = "+19802372331";

/** The human channel, always reachable, never behind a paywall. */
export default function Clothier() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader
        eyebrow="The house"
        title="Your clothier"
        description="For a fitting, an alteration, a commission or anything the app cannot settle."
      />

      <Card>
        <Text variant="subheading">One conversation away</Text>
        <Text variant="bodySmall" tone="muted">
          Messages are answered within one working day. For something urgent, call the showroom directly.
        </Text>
        <Button label="Send a message" onPress={() => void Linking.openURL(`mailto:${CONCIERGE_EMAIL}`)} />
        <Button
          label="Text the house"
          variant="secondary"
          onPress={() => void Linking.openURL(`sms:${CONCIERGE_SMS}`)}
        />
      </Card>

      <Section title="The showrooms">
        <View style={{ gap: space.md }}>
          {showrooms.map((room) => (
            <Card key={room.id}>
              <Text variant="heading">{room.city}</Text>
              <Text variant="bodySmall" tone="muted">
                {room.address}
              </Text>
              <Row label="Hours" value={room.hours} />
              <Button
                label={`Call ${room.phone}`}
                variant="ghost"
                onPress={() => void Linking.openURL(`tel:${room.phone.replace(/[^0-9+]/g, "")}`)}
              />
            </Card>
          ))}
        </View>
      </Section>

      <Section>
        <Button label="Book an appointment" onPress={() => router.push("/circle/appointments")} />
      </Section>

      <Section>
        <Text variant="bodySmall" tone="muted">
          The concierge in the app answers styling questions from your wardrobe. Your clothier is a person, and settles
          anything to do with fit, cloth, commissions or your membership.
        </Text>
      </Section>
    </Screen>
  );
}
