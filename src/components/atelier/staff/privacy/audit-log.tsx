"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { WordSelect } from "@/components/atelier/staff/case/word-select";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, pluralize } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { AuditEntry } from "@convex/atelier/staff";
import { AUDIT_LIMITS, AUDIT_TABLES, auditTarget } from "./privacy-words";

const ACTOR_KIND_WORDS: Record<AuditEntry["actorKind"], string> = {
  staff: "Staff",
  client: "Client",
  system: "System",
};

type Filter = { targetTable: string; targetId: string; limit: number };

/** A08: the audit log, newest first, narrowed by table and record. Rows are facts; nothing here edits them. */
export function AuditLog() {
  const [draft, setDraft] = useState<Filter>({ targetTable: "", targetId: "", limit: 50 });
  const [applied, setApplied] = useState<Filter>(draft);
  const rows = useQuery(api.atelier.staff.auditLog, {
    ...(applied.targetTable ? { targetTable: applied.targetTable } : {}),
    ...(applied.targetTable && applied.targetId ? { targetId: applied.targetId } : {}),
    limit: applied.limit,
  });
  const tableOptions = [
    { code: "", label: "Every table" },
    ...AUDIT_TABLES.map((entry) => ({ code: entry.table, label: entry.words, description: entry.table })),
  ];
  const limitOptions = AUDIT_LIMITS.map((limit) => ({ code: String(limit), label: `${limit} rows` }));

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(draft);
        }}
      >
        <Field>
          <FieldLabel htmlFor="audit-table">Table</FieldLabel>
          <FieldDescription>Narrow to one kind of record.</FieldDescription>
          <WordSelect
            id="audit-table"
            value={draft.targetTable}
            onValueChange={(targetTable) =>
              setDraft((current) => ({ ...current, targetTable, targetId: targetTable ? current.targetId : "" }))
            }
            options={tableOptions}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-id">Record id</FieldLabel>
          <FieldDescription>
            {draft.targetTable ? "Optional; one record's whole history." : "Choose a table first."}
          </FieldDescription>
          <Input
            id="audit-id"
            value={draft.targetId}
            disabled={!draft.targetTable}
            onChange={(event) => setDraft((current) => ({ ...current, targetId: event.target.value.trim() }))}
            className="rounded-sm font-mono text-xs"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-limit">Rows</FieldLabel>
          <WordSelect
            id="audit-limit"
            value={String(draft.limit)}
            onValueChange={(value) => setDraft((current) => ({ ...current, limit: Number(value) }))}
            options={limitOptions}
            className="w-32"
          />
        </Field>
        <Button type="submit" variant="outline" className="h-10 rounded-none px-4">
          Apply
        </Button>
      </form>
      {rows === undefined ? (
        <LoadingRows count={6} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No audit entries match. Every staff action in the Atelier writes one, so an empty log means nothing has
          happened to that record yet.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {pluralize(rows.length, "entry", "entries")}, newest first
            {rows.length === applied.limit ? ` · the first ${applied.limit}; narrow the filter for more` : ""}.
          </p>
          <div className="-mx-4 sm:mx-0">
            <AuditTable rows={rows} />
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditTable({ rows }: { rows: AuditEntry[] }) {
  return (
    <Table className="min-w-[60rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const target = auditTarget(row.targetTable, row.targetId);
          return (
            <TableRow key={row._id} className="align-top">
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatDateTime(row.at)}
                </Mono>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <span>{row.actorName}</span>
                  <span className="text-xs text-muted-foreground">{ACTOR_KIND_WORDS[row.actorKind]}</span>
                </div>
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground">
                  {row.action}
                </Mono>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <span>{target.words}</span>
                  {target.href ? (
                    <Link href={target.href} className="underline-offset-4 hover:underline">
                      <Mono upper={false} className="text-[10px]">
                        {row.targetId}
                      </Mono>
                    </Link>
                  ) : (
                    <Mono upper={false} className="text-[10px]">
                      {row.targetId}
                    </Mono>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[36ch] whitespace-normal">
                {row.meta && Object.keys(row.meta).length > 0 ? (
                  <dl className="flex flex-col gap-0.5 text-xs">
                    {Object.entries(row.meta).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">{key}</dt>
                        <dd className="min-w-0 font-mono text-[11px] break-words">
                          {typeof value === "string" ? value : JSON.stringify(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
