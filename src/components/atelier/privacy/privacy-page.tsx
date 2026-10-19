"use client";

import { useQuery } from "convex/react";
import { DesignsSection } from "@/components/atelier/privacy/designs-section";
import { FitRecordsSection } from "@/components/atelier/privacy/fit-records-section";
import { PhotoSection } from "@/components/atelier/privacy/photo-section";
import { PrivacyRequests } from "@/components/atelier/privacy/privacy-requests";
import { PrivacySkeleton } from "@/components/atelier/privacy/privacy-skeleton";
import { scopeWords } from "@/components/atelier/privacy/privacy-words";
import { usePrivacyRequest } from "@/components/atelier/privacy/use-privacy-request";
import { YourDataSection } from "@/components/atelier/privacy/your-data-section";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { PageHeader } from "@/components/common/page-header";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { api } from "@convex/_generated/api";

/**
 * S34 (C11, C27): the privacy centre. Four sections of controls — photographs and previews, designs, fit
 * records, your data — then every request made, with its steps as they ran. Guests see what this browser
 * holds; the sections that need an account say so and offer sign-in rather than a dead end.
 */
export function PrivacyPage() {
  const viewer = useAtelierViewer();
  const { ready, storageAvailable } = useAtelierSession();
  const ownerArgs = useOwnerArgs({});
  const photo = useQuery(api.atelier.photos.get, ownerArgs);
  const drafts = useQuery(api.atelier.drafts.listMine, ownerArgs);
  const requests = useQuery(api.atelier.privacy.listMine, ownerArgs);
  const privacy = usePrivacyRequest();

  if (!ready || photo === undefined || drafts === undefined || requests === undefined) return <PrivacySkeleton />;

  const signedIn = viewer.status === "signed_in";

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Your privacy."
        description={`What the house holds for ${scopeWords(signedIn)} and the controls over it. Every request runs as recorded steps you can follow here, and nothing is called deleted before it is.`}
      />

      {viewer.status === "signed_out" ? (
        <p className="max-w-2xl border-y border-foreground/15 py-3 text-sm leading-relaxed text-muted-foreground">
          You are not signed in, so this page covers what this browser holds: its photograph, its previews and its
          designs. Fit records and closing an account need the account they belong to.
        </p>
      ) : null}

      {!storageAvailable ? (
        <p className="max-w-2xl border-y border-foreground/15 py-3 text-sm leading-relaxed text-muted-foreground">
          This browser is not keeping drafts, so it holds nothing of yours between visits. The controls below act on
          what the house holds for this visit.
        </p>
      ) : null}

      <div>
        <PhotoSection photo={photo} signedIn={signedIn} privacy={privacy} />
        <DesignsSection drafts={drafts} signedIn={signedIn} privacy={privacy} />
        <FitRecordsSection viewer={viewer} />
        <YourDataSection viewer={viewer} privacy={privacy} />
        <PrivacyRequests requests={requests} ownerArgs={ownerArgs} focusId={privacy.focusId} />
      </div>
    </div>
  );
}
