"use client";

import { useMutation, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toClientError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import {
  isMembershipStatus,
  isMembershipTier,
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_TIERS,
  TIER_LABELS,
  type Membership,
  type MembershipStatus,
  type MembershipTier,
} from "@convex/shared/membership";

type Draft = { tier: MembershipTier; status: MembershipStatus; since: string; renewsAt: string; note: string };

const STATUS_LABELS: Record<MembershipStatus, string> = { active: "Active", lapsed: "Lapsed" };

function toDateInput(timestamp: number | undefined): string {
  return timestamp === undefined ? "" : new Date(timestamp).toISOString().slice(0, 10);
}

/** A yyyy-mm-dd input read at midday UTC, so the date survives any time zone unchanged. */
function fromDateInput(value: string): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function draftFrom(membership: Membership): Draft {
  return {
    tier: membership.tier,
    status: membership.status,
    since: toDateInput(membership.since),
    renewsAt: toDateInput(membership.renewsAt),
    note: "",
  };
}

/** Staff record a member's tier here until the WooCommerce sync takes over. */
export function MembershipForm() {
  const setMembershipTier = useMutation(api.admin.setMembershipTier);
  const [emailInput, setEmailInput] = useState("");
  const [lookupEmail, setLookupEmail] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const member = useQuery(api.admin.lookupMember, lookupEmail ? { email: lookupEmail } : "skip");
  const form = draft ?? (member ? draftFrom(member.membership) : null);
  const canSubmit = Boolean(member && form && !pending);

  function lookup() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    setDraft(null);
    setError(null);
    setLookupEmail(email);
  }

  function update(patch: Partial<Draft>) {
    if (!form) return;
    setDraft({ ...form, ...patch });
  }

  async function handleSubmit() {
    if (!member || !form || pending) return;
    setPending(true);
    setError(null);
    try {
      await setMembershipTier({
        userId: member._id,
        tier: form.tier,
        status: form.status,
        since: fromDateInput(form.since),
        renewsAt: fromDateInput(form.renewsAt),
        note: form.note.trim() || undefined,
      });
      toast.success(`${member.name ?? member.email ?? "Member"} is now ${TIER_LABELS[form.tier]}.`);
      setDraft(null);
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Membership</CardTitle>
        <CardDescription>
          Record a member’s tier as the house sold it. The member sees it on their Membership page at once.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <ErrorAlert title="The membership was not saved" message={error} onRetry={() => void handleSubmit()} />
        ) : null}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="membership-email">Member email</FieldLabel>
            <FieldDescription>The email on their account.</FieldDescription>
            <div className="flex gap-2">
              <Input
                id="membership-email"
                value={emailInput}
                type="email"
                placeholder="member@example.com"
                autoComplete="off"
                onChange={(event) => setEmailInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    lookup();
                  }
                }}
              />
              <Button variant="outline" onClick={lookup} disabled={!emailInput.trim()}>
                <Search data-icon="inline-start" aria-hidden />
                Find
              </Button>
            </div>
          </Field>

          {lookupEmail && member === undefined ? (
            <p className="text-sm text-muted-foreground" role="status">
              <Spinner className="mr-2 inline size-4" /> Looking up {lookupEmail}…
            </p>
          ) : null}
          {lookupEmail && member === null ? (
            <p className="text-sm text-muted-foreground" role="status">
              No account uses {lookupEmail}. Members create their account first; then set their tier here.
            </p>
          ) : null}

          {member && form ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{member.name ?? member.email}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {TIER_LABELS[member.membership.tier]} · {STATUS_LABELS[member.membership.status]}
                  {member.membership.renewsAt ? ` · renews ${formatDate(member.membership.renewsAt)}` : ""}
                  {member.onboardedAt ? "" : " · has not finished onboarding"}
                </span>
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="membership-tier">Tier</FieldLabel>
                  <Select
                    value={form.tier}
                    onValueChange={(value) => {
                      if (typeof value === "string" && isMembershipTier(value)) update({ tier: value });
                    }}
                  >
                    <SelectTrigger id="membership-tier" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBERSHIP_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {TIER_LABELS[tier]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="membership-status">Status</FieldLabel>
                  <Select
                    value={form.status}
                    onValueChange={(value) => {
                      if (typeof value === "string" && isMembershipStatus(value)) update({ status: value });
                    }}
                  >
                    <SelectTrigger id="membership-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBERSHIP_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="membership-since">Member since</FieldLabel>
                  <Input
                    id="membership-since"
                    type="date"
                    value={form.since}
                    onChange={(event) => update({ since: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="membership-renews">Renews</FieldLabel>
                  <FieldDescription>Annual renewal, as billed by the house.</FieldDescription>
                  <Input
                    id="membership-renews"
                    type="date"
                    value={form.renewsAt}
                    onChange={(event) => update({ renewsAt: event.target.value })}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="membership-note">Note</FieldLabel>
                <FieldDescription>Staff only; the member never sees it.</FieldDescription>
                <Input
                  id="membership-note"
                  value={form.note}
                  placeholder="Signature, paid at the Charlotte showroom"
                  onChange={(event) => update({ note: event.target.value })}
                />
              </Field>
            </>
          ) : null}
        </FieldGroup>
      </CardContent>

      <CardFooter className="justify-end">
        <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Save membership
        </Button>
      </CardFooter>
    </Card>
  );
}
