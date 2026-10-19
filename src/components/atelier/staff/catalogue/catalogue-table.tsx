"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toClientError } from "@/lib/errors";
import { formatUsd } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Infer } from "convex/values";
import type { vCatalogueStaffEntryView } from "@convex/atelier/catalogue";
import { CLOTH_PATTERN_LABELS, CLOTH_WEIGHT_LABELS, type CatalogueStatus } from "@convex/shared/atelier/enums";
import {
  CATALOGUE_ACTION_WORDS,
  CATALOGUE_STATUS_TONES,
  CATALOGUE_STATUS_WORDS,
  CATALOGUE_TRANSITIONS,
} from "./catalogue-words";
import { ShadeChip } from "./shade-chip";

export type StaffEntry = Infer<typeof vCatalogueStaffEntryView>;

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * A02: one row per entry with its provenance-bearing facts and the four operations actions. Pure apart from
 * the mutations each action calls; give it entries and it renders the same every time.
 */
export function CatalogueTable({
  entries,
  currentVersion,
  onEdit,
}: {
  entries: StaffEntry[];
  currentVersion: number;
  onEdit: (entry: StaffEntry) => void;
}) {
  const cloth = entries.some((entry) => entry.kind === "cloth");
  return (
    <div className="-mx-4 sm:mx-0">
      <Table className="min-w-[64rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Entry</TableHead>
            <TableHead>Shade</TableHead>
            {cloth ? <TableHead>Cloth</TableHead> : <TableHead>Reference</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry._id} className="align-top">
              <TableCell className="whitespace-normal">
                <div className="flex items-start gap-3">
                  {entry.imageUrl ? (
                    <ItemImage
                      src={entry.imageUrl}
                      alt=""
                      variant="photo"
                      aspect="aspect-square"
                      className="size-10 shrink-0 rounded-sm"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-10 shrink-0 rounded-sm border border-foreground/15"
                      style={{ backgroundColor: entry.hex }}
                    />
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-display text-base leading-tight">{entry.name}</span>
                    <Mono upper={false}>{entry.code}</Mono>
                    <span className="text-xs text-muted-foreground">{entry.provenance}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <ShadeChip hex={entry.hex} confirmed={entry.shadeConfirmed} />
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex max-w-[22ch] flex-col gap-0.5 text-xs">
                  {entry.mill ? <span className="text-sm">{entry.mill}</span> : null}
                  {entry.supplierRef ? <Mono upper={false}>{entry.supplierRef}</Mono> : null}
                  {entry.kind === "cloth" ? (
                    <span className="text-muted-foreground">
                      {[
                        entry.composition,
                        entry.weight ? CLOTH_WEIGHT_LABELS[entry.weight] : null,
                        CLOTH_PATTERN_LABELS[entry.pattern],
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{entry.colour}</span>
                  )}
                  <span className="text-muted-foreground">
                    {entry.priceUsd !== undefined
                      ? `From ${formatUsd(entry.priceUsd)}`
                      : "Price confirmed with the quote"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <StatusLine tone={CATALOGUE_STATUS_TONES[entry.status]}>
                    {CATALOGUE_STATUS_WORDS[entry.status]}
                  </StatusLine>
                  {entry.approvedByName ? (
                    <span className="text-xs text-muted-foreground">by {entry.approvedByName}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <Mono upper={false}>{entry.version === 0 ? "Unpublished" : `v${entry.version}`}</Mono>
                  {entry.pendingPublish ? (
                    <span className="text-xs text-warning">Changed since v{currentVersion}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className={entry.inStock ? undefined : "text-warning"}>
                    {entry.inStock ? "Available" : "Not in stock"}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.sampleAvailable ? "Sample available" : "No sample"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <ShadeDialog entry={entry} />
                  <StockDialog entry={entry} />
                  <StatusActions entry={entry} />
                  <Button variant="ghost" size="xs" onClick={() => onEdit(entry)}>
                    Edit
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ShadeDialog({ entry }: { entry: StaffEntry }) {
  const confirmShade = useMutation(api.atelier.catalogue.confirmShade);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(entry.hex);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = HEX_PATTERN.test(hex.trim());

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await confirmShade({ id: entry._id, hex: hex.trim() });
      toast.success(`${entry.name} now reads “Confirmed shade”.`);
      setOpen(false);
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setHex(entry.hex);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="xs" />}>
        {entry.shadeConfirmed ? "Re-confirm shade" : "Confirm shade"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm the shade of {entry.name}</DialogTitle>
          <DialogDescription>
            Only after a fitter has held the cloth against this colour. Clients then read “Confirmed shade” instead of
            “Representative shade”.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`hex-${entry._id}`}>Shade</FieldLabel>
          <FieldDescription>Six hex digits after a #, like #1F2538.</FieldDescription>
          <div className="flex items-center gap-3">
            <Input
              id={`hex-${entry._id}`}
              value={hex}
              onChange={(event) => setHex(event.target.value)}
              className="w-32 font-mono uppercase"
              aria-invalid={!valid}
              autoComplete="off"
            />
            <ShadeChip hex={valid ? hex.trim() : entry.hex} confirmed={false} words={false} />
          </div>
        </Field>
        {error ? <ErrorAlert title="The shade was not confirmed" message={error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Confirm shade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockDialog({ entry }: { entry: StaffEntry }) {
  const setStock = useMutation(api.atelier.catalogue.setStock);
  const [open, setOpen] = useState(false);
  const [inStock, setInStock] = useState(entry.inStock);
  const [sampleAvailable, setSampleAvailable] = useState(entry.sampleAvailable);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await setStock({ id: entry._id, inStock, sampleAvailable });
      toast.success("Stock recorded.");
      setOpen(false);
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setInStock(entry.inStock);
          setSampleAvailable(entry.sampleAvailable);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="xs" />}>Set stock</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock for {entry.name}</DialogTitle>
          <DialogDescription>
            What the house can supply today. Out of stock is a warning for clients designing with it, never a silent
            substitution.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Label
            htmlFor={`stock-${entry._id}`}
            className="flex min-h-11 items-center justify-between gap-4 font-normal"
          >
            <span className="text-sm">In stock</span>
            <Switch id={`stock-${entry._id}`} checked={inStock} onCheckedChange={setInStock} />
          </Label>
          <Label
            htmlFor={`sample-${entry._id}`}
            className="flex min-h-11 items-center justify-between gap-4 font-normal"
          >
            <span className="text-sm">Sample available to send</span>
            <Switch id={`sample-${entry._id}`} checked={sampleAvailable} onCheckedChange={setSampleAvailable} />
          </Label>
        </div>
        {error ? <ErrorAlert title="Stock was not recorded" message={error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusActions({ entry }: { entry: StaffEntry }) {
  const setStatus = useMutation(api.atelier.catalogue.setStatus);
  const [pending, setPending] = useState<CatalogueStatus | null>(null);
  const legal = CATALOGUE_TRANSITIONS[entry.status];

  async function move(status: CatalogueStatus) {
    setPending(status);
    try {
      await setStatus({ id: entry._id, status });
      toast.success(`${entry.name}: ${CATALOGUE_STATUS_WORDS[status]}.`);
    } catch (caught) {
      toast.error(toClientError(caught).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {legal.map((status) =>
        status === "withdrawn" ? (
          <ConfirmDialog
            key={status}
            destructive
            title={`Withdraw ${entry.name}?`}
            description="Clients stop seeing it in the catalogue. A design that already uses it shows a warning and asks for a replacement; released orders are untouched; nothing is substituted silently."
            confirmLabel="Withdraw"
            onConfirm={() => move(status)}
            trigger={
              <Button variant="ghost" size="xs">
                {CATALOGUE_ACTION_WORDS[status]}
              </Button>
            }
          />
        ) : (
          <Button
            key={status}
            variant={status === "approved" ? "default" : "ghost"}
            size="xs"
            disabled={pending !== null}
            onClick={() => void move(status)}
          >
            {pending === status ? <Spinner data-icon="inline-start" /> : null}
            {CATALOGUE_ACTION_WORDS[status]}
          </Button>
        ),
      )}
    </>
  );
}
