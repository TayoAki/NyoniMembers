"use client";

import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { CatalogueEntryView } from "@convex/atelier/views";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { ClothBrowser, SelectedClothNotice } from "./cloth-browser";
import {
  DEFAULT_CLOTH_FILTERS,
  filterCloths,
  filterOptionsFor,
  replacementsFor,
  type ClothFilters,
} from "./cloth-filtering";
import { ClothFiltersBar } from "./cloth-filters";
import { ClothSheet } from "./cloth-sheet";
import { ClothSkeleton } from "./cloth-skeleton";
import { CompareSheet, type CompareEntry } from "./compare-sheet";
import { ShadeChip } from "./shade-chip";
import { ShortlistTray } from "./shortlist-tray";

/**
 * The cloth step (S03, S04, S05): the shortlist tray, the filters, the book, and the inspection and
 * comparison sheets as overlays. Filter state lives here so opening a sheet never loses it; the choice
 * itself goes through the studio editor, the shortlist straight to the draft.
 */
export function ClothPanel() {
  const { draft, draftId, catalogue, editor, guestKeyArg } = useStudio();
  const setShortlist = useMutation(api.atelier.drafts.setShortlist);

  const [filters, setFilters] = useState<ClothFilters>(DEFAULT_CLOTH_FILTERS);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [choosingCode, setChoosingCode] = useState<string | null>(null);
  const [shortlistPendingCode, setShortlistPendingCode] = useState<string | null>(null);

  const cloths = catalogue?.cloths;
  const filtered = useMemo(() => (cloths ? filterCloths(cloths, filters) : []), [cloths, filters]);
  const options = useMemo(() => filterOptionsFor(cloths ?? []), [cloths]);

  const selectedCode = draft.spec.clothCode;
  const shortlist = draft.shortlist;
  const shortlistFull = shortlist.length >= ATELIER_LIMITS.shortlistMax;
  const locked = draft.status !== "draft";
  const byCode = useMemo(() => new Map((cloths ?? []).map((cloth) => [cloth.code, cloth] as const)), [cloths]);

  const selectedUnavailable =
    draft.cloth && (draft.cloth.status !== "approved" || !draft.cloth.inStock) ? draft.cloth : null;
  const replacements = useMemo(
    () =>
      selectedUnavailable && cloths
        ? replacementsFor(cloths, {
            pattern: selectedUnavailable.pattern,
            occasion: draft.occasion,
            excludeCode: selectedUnavailable.code,
          })
        : [],
    [cloths, draft.occasion, selectedUnavailable],
  );

  const compareEntries: CompareEntry[] = useMemo(
    () => draft.shortlistCloths.map((summary) => ({ summary, entry: byCode.get(summary.code) ?? null })),
    [byCode, draft.shortlistCloths],
  );

  async function choose(code: string) {
    setChoosingCode(code);
    try {
      const outcome = await editor.commit({ clothCode: code });
      if (outcome.status === "failed") toast.error(outcome.message);
      if (outcome.status === "committed") {
        setInspecting(null);
        setCompareOpen(false);
      }
    } finally {
      setChoosingCode(null);
    }
  }

  async function writeShortlist(codes: string[], pendingCode: string) {
    setShortlistPendingCode(pendingCode);
    try {
      await setShortlist({ draftId, ...guestKeyArg, clothCodes: codes });
    } catch (error) {
      reportError(error);
    } finally {
      setShortlistPendingCode(null);
    }
  }

  function toggleShortlist(code: string) {
    if (shortlist.includes(code)) {
      void writeShortlist(
        shortlist.filter((entry) => entry !== code),
        code,
      );
      return;
    }
    if (shortlistFull) {
      setReplacing(code);
      return;
    }
    void writeShortlist([...shortlist, code], code);
  }

  function replaceInShortlist(removeCode: string, addCode: string) {
    setReplacing(null);
    void writeShortlist(
      shortlist.map((entry) => (entry === removeCode ? addCode : entry)),
      addCode,
    );
  }

  if (!cloths) return <ClothSkeleton />;

  const inspected: CatalogueEntryView | null = inspecting ? (byCode.get(inspecting) ?? null) : null;
  const replacingCloth = replacing ? (byCode.get(replacing) ?? null) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">Cloth</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Choose the cloth the house cuts your suit from. The studio figure wears its representative shade; the
          mill-book photograph is the truer reference, and a sample is the truest.
        </p>
      </header>

      {locked ? (
        <Alert className="rounded-none">
          <AlertTitle>This design has been sent to the house</AlertTitle>
          <AlertDescription>
            Its cloth can still be inspected and compared here; to change it, reply on your request and your concierge
            will propose the change.
          </AlertDescription>
        </Alert>
      ) : null}

      {selectedUnavailable ? (
        <SelectedClothNotice
          cloth={selectedUnavailable}
          warnings={draft.warnings}
          replacements={replacements}
          choosingCode={choosingCode}
          locked={locked}
          onChoose={(code) => void choose(code)}
          onInspect={setInspecting}
        />
      ) : null}

      <ShortlistTray
        cloths={draft.shortlistCloths}
        max={ATELIER_LIMITS.shortlistMax}
        selectedCode={selectedCode}
        pendingCode={shortlistPendingCode}
        locked={locked}
        onInspect={setInspecting}
        onRemove={(code) =>
          void writeShortlist(
            shortlist.filter((entry) => entry !== code),
            code,
          )
        }
        onCompare={() => setCompareOpen(true)}
      />

      <ClothFiltersBar
        filters={filters}
        onChange={setFilters}
        options={options}
        shown={filtered.length}
        total={cloths.length}
      />

      <ClothBrowser
        cloths={filtered}
        filters={filters}
        onFiltersChange={setFilters}
        selectedCode={selectedCode}
        shortlist={shortlist}
        choosingCode={choosingCode}
        shortlistPendingCode={shortlistPendingCode}
        locked={locked}
        onInspect={setInspecting}
        onChoose={(code) => void choose(code)}
        onToggleShortlist={toggleShortlist}
      />

      <ClothSheet
        cloth={inspected}
        onClose={() => setInspecting(null)}
        draftId={draftId}
        selected={inspected !== null && inspected.code === selectedCode}
        shortlisted={inspected !== null && shortlist.includes(inspected.code)}
        shortlistFull={shortlistFull}
        choosing={inspected !== null && choosingCode === inspected.code}
        shortlistPending={inspected !== null && shortlistPendingCode === inspected.code}
        locked={locked}
        onChoose={() => (inspected ? void choose(inspected.code) : undefined)}
        onToggleShortlist={() => (inspected ? toggleShortlist(inspected.code) : undefined)}
      />

      <CompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        entries={compareEntries}
        selectedCode={selectedCode}
        choosingCode={choosingCode}
        locked={locked}
        onChoose={(code) => void choose(code)}
        onRemove={(code) =>
          void writeShortlist(
            shortlist.filter((entry) => entry !== code),
            code,
          )
        }
      />

      <Dialog open={replacingCloth !== null} onOpenChange={(next) => (next ? undefined : setReplacing(null))}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Your shortlist is full</DialogTitle>
            <DialogDescription>
              It holds {ATELIER_LIMITS.shortlistMax} cloths. Choose one to make room for{" "}
              <span className="font-medium text-foreground">{replacingCloth?.name}</span>, or keep it as it is.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15">
            {draft.shortlistCloths.map((cloth) => (
              <li key={cloth.code} className="flex items-center gap-3 py-2">
                <ShadeChip hex={cloth.hex} confirmed={cloth.shadeConfirmed} words={false} size="md" />
                <span className="min-w-0 flex-1 truncate text-sm">{cloth.name}</span>
                <Button
                  variant="outline"
                  className="h-11 shrink-0 rounded-none"
                  onClick={() => (replacingCloth ? replaceInShortlist(cloth.code, replacingCloth.code) : undefined)}
                  disabled={shortlistPendingCode !== null}
                  aria-label={`Replace ${cloth.name} with ${replacingCloth?.name ?? "the new cloth"}`}
                >
                  {shortlistPendingCode === cloth.code ? (
                    <Spinner data-icon="inline-start" aria-label="Updating shortlist" />
                  ) : null}
                  Replace
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-none" onClick={() => setReplacing(null)}>
              Keep my shortlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
