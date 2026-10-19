import type { Metadata } from "next";
import { OrdersPage } from "@/components/atelier/orders/orders-page";

export const metadata: Metadata = {
  title: "Orders",
  description:
    "Every commission Nyoni Couture is making or has made for you: release, making, shipping, your fit review and any aftercare, with every stage dated and sourced.",
};

export default function AtelierOrdersPage() {
  return <OrdersPage />;
}
