import type { Metadata } from "next";
import { AppointmentPage } from "@/components/atelier/fittings/appointment-page";

type Params = { params: Promise<{ appointmentId: string }> };

export const metadata: Metadata = {
  title: "Your fitting",
  description:
    "One appointment with the house: its status, the windows you asked for or the confirmed time, and how to change it.",
};

export default async function AtelierAppointmentPage({ params }: Params) {
  const { appointmentId } = await params;
  return <AppointmentPage appointmentId={appointmentId} />;
}
