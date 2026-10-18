import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SharedDesign } from "@/components/atelier/share/shared-design";
import { SharedExpired } from "@/components/atelier/share/shared-expired";
import { api } from "@convex/_generated/api";

type Params = { params: Promise<{ token: string }> };

/** One Convex round trip shared by `generateMetadata` and the page. */
const getShared = cache(async (token: string) => fetchQuery(api.atelier.shares.getByToken, { token }));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const shared = await getShared(token);
  if (!shared) return { title: "Design not found", robots: { index: false } };
  if ("expired" in shared) return { title: "This link has expired", robots: { index: false } };
  return {
    title: shared.name,
    description: `${shared.name} — a suit designed in the Nyoni Atelier, shared read-only.`,
    robots: { index: false },
  };
}

export default async function SharedDesignPage({ params }: Params) {
  const { token } = await params;
  const shared = await getShared(token);
  if (!shared) notFound();
  if ("expired" in shared) return <SharedExpired />;
  return <SharedDesign design={shared} />;
}
