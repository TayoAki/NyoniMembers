import type { Metadata } from "next";
import { JoinPage } from "@/components/atelier/groups/join-page";

type Params = { params: Promise<{ inviteToken: string }> };

export const metadata: Metadata = {
  title: "Your invitation",
  description:
    "An invitation to design with a group at Nyoni Couture: the shared design, which details are yours to choose, and what the organizer will and will not see.",
};

export default async function AtelierJoinGroupPage({ params }: Params) {
  const { inviteToken } = await params;
  return <JoinPage token={inviteToken} />;
}
