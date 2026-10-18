import type { Metadata } from "next";
import { EntryPage } from "@/components/atelier/entry/entry-page";

export const metadata: Metadata = {
  title: "Design your suit",
  description:
    "Design a made-to-measure suit with Nyoni Couture: start from a look or an occasion, choose the cloth and the cut, then ask the house to make it.",
};

export default function AtelierEntryPage() {
  return <EntryPage />;
}
