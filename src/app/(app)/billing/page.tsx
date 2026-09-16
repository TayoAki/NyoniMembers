import type { Metadata } from "next";
import { BillingOverview } from "@/components/billing/billing-overview";
import { CreditPacks } from "@/components/billing/credit-packs";
import { LedgerTable } from "@/components/billing/ledger-table";
import { PlansCard } from "@/components/billing/plans-card";
import { PageHeader } from "@/components/common/page-header";
import { requireSignedIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Billing",
  description: "Your plan, your credits and every line of the ledger.",
};

export default async function BillingPage() {
  await requireSignedIn();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <PageHeader
        title="Billing"
        description="One credit is one generated image. Plan credits refill each cycle, pack credits never expire."
      />
      <BillingOverview />
      <PlansCard />
      <CreditPacks />
      <LedgerTable />
    </div>
  );
}
