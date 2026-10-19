import type { Metadata } from "next";
import { GroupReviewDesk } from "@/components/atelier/staff/groups/group-review";
import { requireStaffPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Group commissions · Atelier desk",
  description:
    "Group commissions awaiting the house's review: the brief, the shared design, who has joined, and the review note.",
};

export default async function AtelierGroupsPage() {
  await requireStaffPage();
  return <GroupReviewDesk />;
}
