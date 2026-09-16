import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditsExplainer } from "@/components/landing/credits-explainer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNav } from "@/components/landing/landing-nav";
import { PricingSummary } from "@/components/landing/pricing-summary";
import { SiteFooter } from "@/components/landing/site-footer";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: { absolute: "Fitcheck — see yourself in the clothes you already own" },
  description:
    "Photograph your clothes, get every item cut out and tagged, build outfits or ask the stylist, and render yourself wearing them. One credit, one image.",
};

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect(routes.wardrobe);

  return (
    <>
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <CreditsExplainer />
        <PricingSummary />
      </main>
      <SiteFooter />
    </>
  );
}
