"use client";

import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { DraftView } from "@convex/atelier/drafts";
import { applyChange, type Conflict, type SpecPatch, type SuitSpec } from "@convex/shared/atelier/spec";
import type { CommitOutcome, SaveScope, SaveStatus, SpecEditor } from "@/components/atelier/studio/panel-contract";
import { reportError, toClientError, type ClientError } from "@/lib/errors";

type SavePhase =
  { state: "idle" } | { state: "saving" } | { state: "saved"; at: number } | { state: "error"; failure: ClientError };

/** A design at a known revision: what a change is previewed and confirmed against. */
type Revisioned = { revision: number; spec: SuitSpec };

type EditorState = {
  /** A change a panel is considering (a detail sheet open): shown on the stage, not written. */
  staged: SpecPatch | null;
  /** The design being written, kept after a failed save so "your change is still here" is true. */
  pending: SuitSpec | null;
  /** What the server last wrote or last held, until the draft subscription catches up with that revision. */
  settled: Revisioned | null;
  phase: SavePhase;
  failedPatch: SpecPatch | null;
};

/**
 * The current design a STALE_REVISION answer carries (another tab or window wrote first), so the
 * change can be previewed on it at once rather than waiting for the subscription.
 */
function staleDesign(error: unknown): Revisioned | null {
  const failure = toClientError(error);
  if (failure.code !== "STALE_REVISION" || !failure.details) return null;
  const { currentRevision, spec } = failure.details;
  if (typeof currentRevision !== "number" || typeof spec !== "object" || spec === null) return null;
  // The server built these details from its own validated draft (`vSuitSpec`), so the shape holds.
  return { revision: currentRevision, spec: spec as SuitSpec };
}

const INITIAL: EditorState = {
  staged: null,
  pending: null,
  settled: null,
  phase: { state: "idle" },
  failedPatch: null,
};

export type SpecEditorOptions = {
  draft: DraftView;
  /** Stable between renders: it sits in the commit callback's dependencies. */
  guestKeyArg: { guestKey?: string };
  /** Asks the client to confirm the dependency engine's conflicts (S08); resolves true to apply them all. */
  confirmConflicts: (conflicts: Conflict[]) => Promise<boolean>;
};

export type SpecEditorHandle = {
  editor: SpecEditor;
  /** The failure behind an error state, so the status line can offer the right way out. */
  lastFailure: ClientError | null;
  /** Re-sends the change that failed; null when nothing failed. */
  retry: (() => void) | null;
  /** Drops the change that failed and returns the stage to the committed design. */
  discard: (() => void) | null;
};

/**
 * The spec editor behind `useStudio().editor`: previews are pure `applyChange` calls, commits run
 * the dependency engine locally, confirm conflicts through the core's dialog, then write through
 * `drafts.commit` against the revision they were confirmed on. The stage shows the proposed design
 * while saving; the committed design is always what the server returned (contract §6, cross-cutting
 * scenario 2). When another window wrote first the server refuses the stale write, this shows the
 * current design, previews the change on it and asks again.
 */
export function useSpecEditor({ draft, guestKeyArg, confirmConflicts }: SpecEditorOptions): SpecEditorHandle {
  const commitMutation = useMutation(api.atelier.drafts.commit);
  const [state, setState] = useState<EditorState>(INITIAL);
  const scope: SaveScope = draft.ownedByAccount ? "account" : "browser";

  const base = useMemo<Revisioned>(
    () =>
      state.settled && state.settled.revision > draft.revision
        ? state.settled
        : { revision: draft.revision, spec: draft.spec },
    [state.settled, draft.revision, draft.spec],
  );
  const spec = base.spec;
  const shown = state.pending ?? (state.staged ? applyChange(spec, state.staged).spec : spec);

  const preview = useCallback((patch: SpecPatch) => applyChange(spec, patch), [spec]);
  const stage = useCallback((patch: SpecPatch | null) => setState((current) => ({ ...current, staged: patch })), []);

  const commit = useCallback(
    async (patch: SpecPatch): Promise<CommitOutcome> => {
      const attempt = async (against: Revisioned, afterStale: boolean): Promise<CommitOutcome> => {
        const local = applyChange(against.spec, patch);
        let accepted = false;
        if (local.conflicts.length > 0) {
          accepted = await confirmConflicts(local.conflicts);
          if (!accepted) return { status: "cancelled", conflicts: local.conflicts };
        }
        setState((current) => ({ ...current, pending: local.spec, phase: { state: "saving" }, failedPatch: null }));
        try {
          const args = { draftId: draft._id, ...guestKeyArg, patch, baseRevision: against.revision };
          let result = await commitMutation({ ...args, acceptedConflicts: accepted });
          if (!result.applied && result.conflicts.length > 0 && !accepted) {
            // The server saw a dependency the local engine did not (a catalogue fact); ask once more.
            const ok = await confirmConflicts(result.conflicts);
            if (!ok) {
              setState((current) => ({ ...current, pending: null, phase: { state: "idle" } }));
              return { status: "cancelled", conflicts: result.conflicts };
            }
            result = await commitMutation({ ...args, acceptedConflicts: true });
          }
          const at = Date.now();
          setState((current) => ({
            ...current,
            staged: null,
            pending: null,
            settled: result.applied ? { revision: result.revision, spec: result.spec } : current.settled,
            phase: { state: "saved", at },
            failedPatch: null,
          }));
          return { status: "committed", conflicts: result.conflicts, spec: result.spec };
        } catch (error) {
          const fresh = afterStale ? null : staleDesign(error);
          if (fresh) {
            // Another window wrote first: show its design, preview the change on it and ask once more.
            setState((current) => ({ ...current, pending: null, settled: fresh, phase: { state: "idle" } }));
            return attempt(fresh, true);
          }
          const failure = reportError(error, "Could not save your change.");
          setState((current) => ({ ...current, phase: { state: "error", failure }, failedPatch: patch }));
          return { status: "failed", message: failure.message, code: failure.code };
        }
      };
      return attempt(base, false);
    },
    [base, confirmConflicts, commitMutation, draft._id, guestKeyArg],
  );

  const failedPatch = state.failedPatch;
  const retry = useMemo(() => (failedPatch ? () => void commit(failedPatch) : null), [failedPatch, commit]);
  const discard = useMemo(
    () =>
      failedPatch
        ? () => setState((current) => ({ ...current, pending: null, failedPatch: null, phase: { state: "idle" } }))
        : null,
    [failedPatch],
  );

  const saving = useMemo<SaveStatus>(() => {
    switch (state.phase.state) {
      case "idle":
        return { state: "idle", scope, at: draft.savedAt };
      case "saving":
        return { state: "saving", scope, at: draft.savedAt };
      case "saved":
        return { state: "saved", scope, at: state.phase.at };
      case "error":
        return { state: "error", scope, at: draft.savedAt, message: state.phase.failure.message };
    }
  }, [state.phase, scope, draft.savedAt]);

  const editor = useMemo<SpecEditor>(
    () => ({ spec, shown, preview, stage, commit, saving }),
    [spec, shown, preview, stage, commit, saving],
  );

  return {
    editor,
    lastFailure: state.phase.state === "error" ? state.phase.failure : null,
    retry,
    discard,
  };
}
