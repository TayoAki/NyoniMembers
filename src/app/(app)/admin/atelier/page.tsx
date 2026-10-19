import type { Metadata } from "next";
import { CaseQueue } from "@/components/atelier/staff/queue/case-queue";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Atelier desk",
  description: "The intake queue: every request a client has sent, its owner, its status and its next action.",
};

export default async function AtelierDeskPage() {
  await requireAdminPage();
  return <CaseQueue />;
}
