"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelative, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { FitQueueItem } from "@convex/atelier/fit";
import { FIT_STATUS_TONES, flagWords } from "./fit-words";

/**
 * A03: the fitter's queue as a dense table. Pure: rows in, the same table out. The whole row opens the
 * review; the client's name is the real link so the keyboard and screen readers reach it.
 */
export function FitQueueTable({ rows, className }: { rows: FitQueueItem[]; className?: string }) {
  const router = useRouter();
  return (
    <Table className={cn("min-w-[52rem]", className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Client</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Provenance</TableHead>
          <TableHead>For your attention</TableHead>
          <TableHead>Photographs</TableHead>
          <TableHead>Submitted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const href = routes.staffAtelier.fitProfile(row.profileId);
          const flags = flagWords(row);
          return (
            <TableRow
              key={row.profileId}
              className="cursor-pointer align-top"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) return;
                router.push(href);
              }}
            >
              <TableCell className="font-medium">
                <Link href={href} className="inline-flex min-h-7 items-center underline-offset-4 hover:underline">
                  {row.clientName}
                </Link>
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  v{row.version}
                </Mono>
              </TableCell>
              <TableCell>
                <StatusLine tone={FIT_STATUS_TONES[row.status]}>{row.statusLabel}</StatusLine>
              </TableCell>
              <TableCell className="whitespace-normal">{row.provenanceLabel}</TableCell>
              <TableCell className="whitespace-normal">
                {flags.length === 0 ? (
                  <span className="text-muted-foreground">Nothing flagged</span>
                ) : (
                  <ul className="flex max-w-[26ch] flex-col gap-0.5 text-warning">
                    {flags.map((words) => (
                      <li key={words}>{words}</li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className={cn(row.photoCount === 0 && "text-muted-foreground")}>
                {row.photoCount === 0 ? "None" : pluralize(row.photoCount, "photograph")}
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatRelative(row.requestedAt)}
                </Mono>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
