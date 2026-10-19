import type { Metadata } from "next";
import { PrivacyBoard } from "@/components/atelier/staff/privacy/privacy-board";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Privacy · Atelier desk",
  description: "Privacy requests step by step, staff roles, and the audit log.",
};

export default async function AtelierPrivacyPage() {
  await requireAdminPage();
  return <PrivacyBoard />;
}
