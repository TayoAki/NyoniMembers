import type { Metadata } from "next";
import { LinkDrafts } from "@/components/atelier/link/link-drafts";

export const metadata: Metadata = {
  title: "Save designs to your account",
  description: "Move the suit designs this browser holds to your Nyoni account so they follow you to another device.",
};

export default function AtelierLinkPage() {
  return <LinkDrafts />;
}
