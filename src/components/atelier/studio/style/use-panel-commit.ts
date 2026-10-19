"use client";

import { useCallback, useState } from "react";
import type { SpecPatch } from "@convex/shared/atelier/spec";
import { useStudio, type CommitOutcome } from "@/components/atelier/studio/panel-contract";

export type CommitFailure = { tag: string; code: string; message: string; patch: SpecPatch };

/**
 * One in-flight commit at a time for a panel: `pending` names what is saving so the row can show it,
 * `failure` keeps the last failed patch so "Try again" resends exactly that change. Conflicts are the
 * core's business (its dialog runs inside `editor.commit`); only "failed" outcomes land here.
 */
export function usePanelCommit() {
  const { editor } = useStudio();
  const commit = editor.commit;
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<CommitFailure | null>(null);

  const run = useCallback(
    async (tag: string, patch: SpecPatch): Promise<CommitOutcome> => {
      setPending(tag);
      setFailure(null);
      try {
        const outcome = await commit(patch);
        if (outcome.status === "failed") setFailure({ tag, code: outcome.code, message: outcome.message, patch });
        return outcome;
      } finally {
        setPending(null);
      }
    },
    [commit],
  );

  const retry = useCallback(() => {
    if (failure) void run(failure.tag, failure.patch);
  }, [failure, run]);

  return { pending, failure, run, retry };
}
