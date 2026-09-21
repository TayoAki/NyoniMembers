import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SharedRender } from "@/components/share/shared-render";
import { api } from "@convex/_generated/api";

/** Cached per request so `generateMetadata` and the page itself share one Convex round trip. */
const getShared = cache(async (token: string) => fetchQuery(api.renders.getShared, { token }));

export async function generateMetadata({ params }: PageProps<"/share/[token]">): Promise<Metadata> {
  const { token } = await params;
  const shared = await getShared(token);
  if (!shared) return { title: "Render not found", robots: { index: false } };
  return {
    title: shared.outfitName,
    description: `${shared.outfitName} — previewed with Nyoni Members.`,
    openGraph: {
      title: `${shared.outfitName} · Nyoni Members`,
      description: "Previewed with Nyoni Members.",
      images: [{ url: shared.url, alt: shared.outfitName }],
      type: "article",
    },
    twitter: { card: "summary_large_image", images: [shared.url] },
  };
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const shared = await getShared(token);
  if (!shared) notFound();
  return <SharedRender shared={shared} />;
}
