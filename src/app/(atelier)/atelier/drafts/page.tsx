import type { Metadata } from "next";
import { DraftsPage } from "@/components/atelier/drafts/drafts-page";

export const metadata: Metadata = {
  title: "Your drafts",
  description: "Resume, rename, duplicate or archive the suit designs saved by this browser or to your account.",
};

export default function AtelierDraftsPage() {
  return <DraftsPage />;
}
