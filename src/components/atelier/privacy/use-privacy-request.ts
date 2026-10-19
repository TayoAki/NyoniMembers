"use client";

import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PRIVACY_KIND_LABELS, type PrivacyKind } from "@convex/shared/atelier/enums";

export type PrivacyRequestFailure = { kind: PrivacyKind; error: ClientError };

export type UsePrivacyRequest = {
  /** Opens a request of this kind. Throws what the server threw, after recording it, so a dialog can stay open. */
  submit: (kind: PrivacyKind) => Promise<Id<"atelierPrivacyRequests">>;
  pendingKind: PrivacyKind | null;
  failure: PrivacyRequestFailure | null;
  clearFailure: () => void;
  /** The request the page should scroll to: the one just opened, or the open one the server pointed at. */
  focusId: Id<"atelierPrivacyRequests"> | null;
};

/**
 * One privacy request at a time (C27). The server keeps one open request per kind: asking again while
 * one is in motion returns it as a duplicate, which is a success here — the page shows that request.
 */
export function usePrivacyRequest(): UsePrivacyRequest {
  const guestKeyArg = useGuestKeyArg();
  const request = useMutation(api.atelier.privacy.request);
  const [pendingKind, setPendingKind] = useState<PrivacyKind | null>(null);
  const [failure, setFailure] = useState<PrivacyRequestFailure | null>(null);
  const [focusId, setFocusId] = useState<Id<"atelierPrivacyRequests"> | null>(null);

  const submit = useCallback(
    async (kind: PrivacyKind) => {
      setPendingKind(kind);
      setFailure(null);
      try {
        const result = await request({ ...guestKeyArg, kind });
        setFocusId(result.requestId);
        if (result.duplicate) {
          toast.message(`${PRIVACY_KIND_LABELS[kind]}: a request is already in motion.`, {
            description: "Its steps are listed under Your requests.",
          });
        } else {
          toast.success(`${PRIVACY_KIND_LABELS[kind]}: request received.`, {
            description: "Its steps are recorded under Your requests as they run.",
          });
        }
        return result.requestId;
      } catch (error) {
        setFailure({ kind, error: toClientError(error) });
        throw error;
      } finally {
        setPendingKind(null);
      }
    },
    [guestKeyArg, request],
  );

  const clearFailure = useCallback(() => setFailure(null), []);

  return { submit, pendingKind, failure, clearFailure, focusId };
}
