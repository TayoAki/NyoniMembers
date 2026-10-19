import type { Metadata } from "next";
import { QuotesQueue } from "@/components/atelier/staff/quotes/quotes-queue";
import { requireStaffPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Quotes · Atelier desk",
  description: "Quotes offered to clients by expiry, and quotes still being prepared.",
};

export default async function AtelierQuotesPage() {
  await requireStaffPage();
  return <QuotesQueue />;
}
