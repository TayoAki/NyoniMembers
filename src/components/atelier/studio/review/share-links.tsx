"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { ShareView } from "@convex/atelier/shares";
import { ATELIER_LIMITS, SHARE_STATE_LABELS, type ShareState } from "@convex/shared/atelier/enums";
import { StatusLine, type StatusTone } from "@/components/atelier/common/status-line";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { ReviewBlockSkeleton } from "./review-skeleton";

const DAY_CHOICES = [1, 7, 14, 30].filter((days) => days <= ATELIER_LIMITS.shareMaxDays);
const DEFAULT_DAYS = DAY_CHOICES.includes(7) ? 7 : ATELIER_LIMITS.shareMaxDays;

const STATE_TONES: Record<ShareState, StatusTone> = { active: "success", expired: "neutral", revoked: "neutral" };

type Issued = { audience: string; token: string; url: string; days: number };

function dayWords(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function shareUrl(token: string): string {
  return `${window.location.origin}${routes.atelier.shared(token)}`;
}

function stateWords(share: ShareView): string {
  const label = SHARE_STATE_LABELS[share.state];
  if (share.state === "active") return `${label} until ${formatDate(share.expiresAt)}`;
  if (share.state === "revoked" && share.revokedAt !== undefined) return `${label} ${formatDate(share.revokedAt)}`;
  return `${label} ${formatDate(share.expiresAt)}`;
}

/** Copies a link, or says how to copy it when this browser will not. Returns whether it was copied. */
async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    toast.message("Copy the link from the field: this browser did not allow copying automatically.");
    return false;
  }
}

/**
 * C13 step 3 and cross-cutting scenario 5: a read-only link to the design, for an audience the owner
 * names and for a number of days they choose. It carries the design and its cloth, never the owner's
 * photographs, previews, measurements or contact details; nothing is sent from here; a link can be
 * revoked at once. Guests share from this browser as owners do from an account.
 */
export function ShareLinks() {
  const { draft, draftId, ownerArgs, guestKeyArg } = useStudio();
  const shares = useQuery(api.atelier.shares.listForDraft, { draftId, ...ownerArgs });
  const create = useMutation(api.atelier.shares.create);
  const id = useId();
  const [audience, setAudience] = useState("");
  const [days, setDays] = useState<number>(DEFAULT_DAYS);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const archived = draft.status === "archived";
  // The link just made stays on screen to copy until it is revoked or runs out.
  const issuedShare = issued ? shares?.find((share) => share.token === issued.token) : undefined;
  const showIssued = issued !== null && (issuedShare === undefined || issuedShare.state === "active");
  const trimmed = audience.trim();
  const audienceError =
    trimmed.length === 0
      ? "Say who this link is for, so you can tell your links apart later."
      : trimmed.length > ATELIER_LIMITS.shareAudienceMax
        ? `Keep it to ${ATELIER_LIMITS.shareAudienceMax} characters.`
        : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (audienceError) return;
    setPending(true);
    setError(null);
    try {
      const result = await create({ draftId, ...guestKeyArg, audience: trimmed, expiresInDays: days });
      setIssued({ audience: trimmed, token: result.token, url: shareUrl(result.token), days });
      setAudience("");
      setAttempted(false);
    } catch (failure) {
      const clientError = toClientError(failure);
      setError(clientError);
      toast.error(clientError.message);
    } finally {
      setPending(false);
    }
  };

  const copy = async (key: string, url: string) => {
    if (await copyLink(url)) setCopied(key);
  };

  return (
    <div className="space-y-5">
      {archived ? (
        <StatusLine tone="warning" className="text-sm">
          An archived design cannot be shared. Duplicate it to share it again; links made before stay listed below.
        </StatusLine>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
          <Field data-invalid={attempted && audienceError ? true : undefined}>
            <FieldLabel htmlFor={`${id}-audience`}>Who it is for</FieldLabel>
            <Input
              id={`${id}-audience`}
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              maxLength={ATELIER_LIMITS.shareAudienceMax}
              autoComplete="off"
              placeholder="My best man"
              disabled={pending}
              aria-invalid={attempted && audienceError ? true : undefined}
              aria-describedby={`${id}-audience-help`}
              className="h-11 max-w-sm rounded-none"
            />
            <FieldDescription id={`${id}-audience-help`}>
              For your list only, so you can tell your links apart; the person who opens it does not see it.
            </FieldDescription>
            <FieldError>{attempted ? audienceError : undefined}</FieldError>
          </Field>
          <div className="space-y-2">
            <p id={`${id}-days`} className="text-sm font-medium">
              Open for
            </p>
            <ToggleGroup
              aria-labelledby={`${id}-days`}
              variant="outline"
              spacing={0}
              value={[String(days)]}
              disabled={pending}
              onValueChange={(values) => {
                const next = Number(values[0]);
                if (DAY_CHOICES.includes(next)) setDays(next);
              }}
            >
              {DAY_CHOICES.map((choice) => (
                <ToggleGroupItem key={choice} value={String(choice)} className="h-11 min-w-11 px-3 text-[13px]">
                  {dayWords(choice)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Button type="submit" className="h-11 rounded-none px-5" disabled={pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-label="Creating the link" /> : null}
            {pending ? "Creating…" : "Create link"}
          </Button>
        </form>
      )}

      {error ? (
        <ErrorAlert
          title="Could not create the link"
          message={error.message}
          onRetry={() => setError(null)}
          retryLabel="Dismiss"
        />
      ) : null}

      {issued && showIssued ? (
        <div className="space-y-3 border-y border-foreground/15 py-4" role="status" aria-live="polite">
          <p className="text-sm">
            Link for <span className="font-medium">{issued.audience}</span>, open for {dayWords(issued.days)}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={issued.url}
              aria-label={`Share link for ${issued.audience}`}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-none font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-none px-5"
              onClick={() => void copy("issued", issued.url)}
            >
              {copied === "issued" ? "Copied" : "Copy link"}
            </Button>
          </div>
          <FieldDescription>Nothing is sent from here: copy the link and pass it on yourself.</FieldDescription>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Your links</p>
        {shares === undefined ? (
          <ReviewBlockSkeleton lines={2} />
        ) : shares.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No links yet. A link you create is listed here until you revoke it.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15">
            {shares.map((share) => (
              <ShareRow
                key={share._id}
                share={share}
                copied={copied === share._id}
                onCopy={() => void copy(share._id, shareUrl(share.token))}
                guestKeyArg={guestKeyArg}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShareRow({
  share,
  copied,
  onCopy,
  guestKeyArg,
}: {
  share: ShareView;
  copied: boolean;
  onCopy: () => void;
  guestKeyArg: { guestKey?: string };
}) {
  const revoke = useMutation(api.atelier.shares.revoke);
  const active = share.state === "active";
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{share.audience}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <StatusLine tone={STATE_TONES[share.state]}>{stateWords(share)}</StatusLine>
          <span>Created {formatDate(share.createdAt)}</span>
        </div>
      </div>
      {active ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" className="h-11 rounded-none px-4" onClick={onCopy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="h-11 rounded-none px-4">
                Revoke
                <span className="sr-only"> the link for {share.audience}</span>
              </Button>
            }
            title={`Revoke the link for ${share.audience}?`}
            description="Anyone who opens it afterwards is told it has expired. Your design is unchanged, and you can make a new link at any time."
            confirmLabel="Revoke link"
            destructive
            onConfirm={async () => {
              await revoke({ ...guestKeyArg, shareId: share._id });
              toast.success(`The link for ${share.audience} is revoked.`);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}
