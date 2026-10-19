import type { Metadata } from "next";
import { CatalogueDesk } from "@/components/atelier/staff/catalogue/catalogue-desk";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Catalogue · Atelier desk",
  description:
    "Approve, withdraw and publish the cloths, buttons and linings the house offers; confirm shades and stock.",
};

export default async function AtelierCataloguePage() {
  await requireAdminPage();
  return <CatalogueDesk />;
}
