import type { Metadata } from "next";
import { RequestsPage } from "@/components/atelier/requests/requests-page";

export const metadata: Metadata = {
  title: "Requests",
  description:
    "Every request you have sent Nyoni Couture — a quote, a design review, a cloth sample, a fitting or a question — with its concierge and its latest word.",
};

export default function AtelierRequestsPage() {
  return <RequestsPage />;
}
