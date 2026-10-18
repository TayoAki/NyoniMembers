import type { Metadata } from "next";
import { MembershipBenefit } from "@/components/atelier/membership/membership-benefit";

export const metadata: Metadata = {
  title: "Membership and the annual suit",
  description:
    "Your Nyoni Circle tier as the house recorded it, and whether this year's made-to-measure suit is included.",
};

export default function AtelierMembershipPage() {
  return <MembershipBenefit />;
}
