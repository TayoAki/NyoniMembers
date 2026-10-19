import type { Metadata } from "next";
import { PrivacyBoard } from "@/components/atelier/staff/privacy/privacy-board";
import { requireStaffPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Privacy · Atelier desk",
  description: "Privacy requests step by step, staff roles, and the audit log.",
};

export default async function AtelierPrivacyPage() {
  await requireStaffPage();
  return <PrivacyBoard />;
}
