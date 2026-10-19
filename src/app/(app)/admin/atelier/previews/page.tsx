import type { Metadata } from "next";
import { PreviewOps } from "@/components/atelier/staff/previews/preview-ops";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Preview operations · Atelier desk",
  description: "Personal-preview jobs by status, quality flags, and audited access to results.",
};

export default async function AtelierPreviewsPage() {
  await requireAdminPage();
  return <PreviewOps />;
}
