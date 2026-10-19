import type { Metadata } from "next";
import { OrderPage } from "@/components/atelier/orders/order-page";

type Params = { params: Promise<{ orderId: string }> };

export const metadata: Metadata = {
  title: "Your commission",
  description:
    "One commission with the house: its production stages, payment state, the first-fit checklist, aftercare, and what the published policy allows.",
};

export default async function AtelierOrderPage({ params }: Params) {
  const { orderId } = await params;
  return <OrderPage orderId={orderId} />;
}
