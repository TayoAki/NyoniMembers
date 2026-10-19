"use client";

import { useQuery } from "convex/react";
import { Layers } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pluralize } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { CatalogueKind } from "@convex/shared/atelier/enums";
import { CatalogueSkeleton } from "./catalogue-skeleton";
import { CatalogueTable, type StaffEntry } from "./catalogue-table";
import {
  CATALOGUE_DESCRIPTION,
  CATALOGUE_KIND_WORDS,
  CATALOGUE_KINDS_ORDER,
  CATALOGUE_TITLE,
  isCatalogueKind,
} from "./catalogue-words";
import { EntryForm } from "./entry-form";
import { PublishVersionDialog, VersionHistory } from "./publish-version";

/** A02 (O02): entries by kind with their operations actions, the add form, and version publishing. */
export function CatalogueDesk() {
  return (
    <StaffShell title={CATALOGUE_TITLE} description={CATALOGUE_DESCRIPTION}>
      <StaffRoleGate role="operations" fallback={<CatalogueSkeleton />}>
        <CatalogueBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

function CatalogueBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("kind");
  const [kind, setKindState] = useState<CatalogueKind>(isCatalogueKind(requested) ? requested : "cloth");
  const [form, setForm] = useState<{ open: boolean; entry: StaffEntry | null }>({ open: false, entry: null });
  const entries = useQuery(api.atelier.catalogue.listAll, {});
  const currentVersion = useQuery(api.atelier.catalogue.currentVersion, {});
  const versions = useQuery(api.atelier.catalogue.listVersions, { limit: 10 });

  const setKind = useCallback(
    (next: CatalogueKind) => {
      setKindState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("kind", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (entries === undefined || currentVersion === undefined || versions === undefined) return <CatalogueSkeleton />;

  const pendingCount = entries.filter((entry) => entry.pendingPublish).length;
  const ofKind = entries.filter((entry) => entry.kind === kind);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-foreground/15 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="flex items-baseline gap-2">
            Catalogue version{" "}
            <Mono className="text-foreground">{currentVersion === 0 ? "none" : `v${currentVersion}`}</Mono>
          </span>
          <span className="text-muted-foreground">
            {currentVersion === 0
              ? "Nothing published yet."
              : pendingCount === 0
                ? "Every entry is stamped with the current version."
                : `${pluralize(pendingCount, "entry", "entries")} changed since it was published.`}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-none px-4"
            onClick={() => setForm({ open: true, entry: null })}
          >
            Add entry
          </Button>
          <PublishVersionDialog currentVersion={currentVersion} pendingCount={pendingCount} />
        </div>
      </div>

      <Tabs
        value={kind}
        onValueChange={(value) => {
          const next = String(value);
          if (isCatalogueKind(next)) setKind(next);
        }}
        className="gap-6"
      >
        <TabsList
          variant="line"
          aria-label="Catalogue kinds"
          className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
        >
          {CATALOGUE_KINDS_ORDER.map((entry) => (
            <TabsTrigger
              key={entry}
              value={entry}
              className="h-11 flex-none gap-2 px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
            >
              {CATALOGUE_KIND_WORDS[entry].plural}
              <Mono upper={false} className="text-[11px]">
                {entries.filter((candidate) => candidate.kind === entry).length}
              </Mono>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={kind}>
          {ofKind.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={`No ${CATALOGUE_KIND_WORDS[kind].plural.toLowerCase()} yet`}
              description="Add one with its provenance; it starts as a draft clients do not see."
              action={
                <Button variant="outline" onClick={() => setForm({ open: true, entry: null })}>
                  Add a {CATALOGUE_KIND_WORDS[kind].singular.toLowerCase()}
                </Button>
              }
            />
          ) : (
            <CatalogueTable
              entries={ofKind}
              currentVersion={currentVersion}
              onEdit={(entry) => setForm({ open: true, entry })}
            />
          )}
        </TabsContent>
      </Tabs>

      <AtelierSection
        id="versions"
        title="Versions"
        description="Each publish is a number every design compares itself to. The audit log records who pressed it and what was stamped."
      >
        <VersionHistory versions={versions} />
      </AtelierSection>

      <EntryForm
        open={form.open}
        onOpenChange={(open) => setForm((previous) => ({ ...previous, open }))}
        entry={form.entry}
        kind={kind}
      />
    </div>
  );
}
