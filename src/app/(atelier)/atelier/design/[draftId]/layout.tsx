import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StudioFrame } from "@/components/atelier/studio/studio-frame";
import { StudioProvider } from "@/components/atelier/studio/studio-provider";

export const metadata: Metadata = { title: "Design studio" };

/**
 * The studio: the stage and the step rail persist here while `[step]` swaps the panel. The provider
 * validates the id (a malformed one is "not here" without a round trip; an unknown or foreign one is
 * answered null by the server, so a guest never learns whether a draft exists).
 */
export default async function DesignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  return (
    <StudioProvider draftId={draftId}>
      <StudioFrame>{children}</StudioFrame>
    </StudioProvider>
  );
}
