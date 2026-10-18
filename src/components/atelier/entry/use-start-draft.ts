"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Occasion } from "@convex/shared/atelier/enums";
import { lookByKey } from "@convex/shared/atelier/looks";

/** The server's default name for a draft started without a look (`DEFAULT_DRAFT_NAME` in the drafts model). */
const DEFAULT_DRAFT_NAME = "Your suit";

export type StartDraftInput = { lookKey?: string; occasion?: Occasion };

/**
 * Creates a draft for this browser (or the signed-in account), remembers it in the local index and
 * goes to the studio. One creation at a time: `pending` names the action in flight so every start
 * control can disable itself and the one pressed can show a spinner.
 */
export function useStartDraft() {
  const router = useRouter();
  const create = useMutation(api.atelier.drafts.create);
  const guestKeyArg = useGuestKeyArg();
  const { ready, guestKey, rememberDraft } = useAtelierSession();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<ClientError | null>(null);

  /** False until the session has read storage: the key the server needs is unknown before that. */
  const canStart = ready && guestKey !== null;

  async function start(input: StartDraftInput, key: string): Promise<void> {
    if (pending) return;
    setPending(key);
    setError(null);
    try {
      const draftId = await create({ ...guestKeyArg, ...input });
      const look = input.lookKey ? lookByKey(input.lookKey) : undefined;
      rememberDraft({ draftId, name: look?.name ?? DEFAULT_DRAFT_NAME, updatedAt: Date.now() });
      router.push(input.occasion ? routes.atelier.step(draftId, "occasion") : routes.atelier.design(draftId));
      // The studio takes over; the pending state stays until the route changes so the button cannot fire twice.
    } catch (caught) {
      setError(toClientError(caught));
      setPending(null);
    }
  }

  return { start, pending, error, canStart, clearError: () => setError(null) };
}
