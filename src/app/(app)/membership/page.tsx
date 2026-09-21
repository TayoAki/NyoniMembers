import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { MembershipOverview } from "@/components/membership/membership-overview";
import { requireSignedIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Membership",
  description: "Your membership, what it includes, and how to reach the house.",
};

export default async function MembershipPage() {
  await requireSignedIn();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Your account"
        title="Membership."
        description="Your tier, what it includes, and your concierge."
      />
      <MembershipOverview />
    </div>
  );
}
