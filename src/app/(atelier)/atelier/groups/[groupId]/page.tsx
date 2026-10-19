import type { Metadata } from "next";
import { GroupPage } from "@/components/atelier/groups/group-page";

type Params = { params: Promise<{ groupId: string }> };

export const metadata: Metadata = {
  title: "Your group",
  description:
    "One group commission: the brief, the shared design, each participant's consented readiness and the invitations — never anyone's measurements, photographs or private design.",
};

export default async function AtelierGroupPage({ params }: Params) {
  const { groupId } = await params;
  return <GroupPage groupId={groupId} />;
}
