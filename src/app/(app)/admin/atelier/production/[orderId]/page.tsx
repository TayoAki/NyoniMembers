import type { Metadata } from "next";
import { OrderDesk } from "@/components/atelier/staff/production/order-desk";
import { requireStaffPage } from "@/lib/auth";

type Params = { params: Promise<{ orderId: string }> };

export const metadata: Metadata = {
  title: "Commission · Atelier desk",
  description:
    "One commission: its blockers, release, payment record, milestones, shipping and the specification the cutter has.",
};

export default async function AtelierOrderPage({ params }: Params) {
  await requireStaffPage();
  const { orderId } = await params;
  return <OrderDesk orderId={orderId} />;
}
