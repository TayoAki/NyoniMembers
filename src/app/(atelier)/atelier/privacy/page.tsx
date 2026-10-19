import type { Metadata } from "next";
import { PrivacyPage } from "@/components/atelier/privacy/privacy-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Nyoni Couture holds for you in the Atelier — photographs and previews, designs, fit records — and the controls over it: removal, export and closing your account, each as recorded steps.",
};

export default function AtelierPrivacyPage() {
  return <PrivacyPage />;
}
