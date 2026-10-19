"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { StaffForbidden } from "@/components/atelier/staff/staff-shell";
import { ErrorAlert } from "@/components/common/error-alert";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffMember, StaffStatus } from "@convex/atelier/staff";
import { STAFF_ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@convex/shared/atelier/enums";

/** A08: who holds which role. Admin only; every change is audited as `staff.setRoles` with before and after. */
export function StaffRoles({ me }: { me: StaffStatus | null }) {
  if (!me?.isAdmin) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Roles are set by an admin. The server refuses anyone else, so there is nothing here to work around.
        </p>
        <StaffForbidden />
      </div>
    );
  }
  return <StaffRolesAdmin />;
}

function StaffRolesAdmin() {
  const members = useQuery(api.atelier.staff.list, {});
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Admins hold every role. Each row saves on its own; the change is written to the audit log with the roles
          before and after.
        </p>
        {members === undefined ? (
          <LoadingRows count={4} />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody holds a role yet. Add a person below.</p>
        ) : (
          <div className="-mx-4 sm:mx-0">
            <StaffRolesTable members={members} />
          </div>
        )}
      </div>
      <AddStaffForm existing={members ?? []} />
    </div>
  );
}

export function StaffRolesTable({ members }: { members: StaffMember[] }) {
  return (
    <Table className="min-w-[56rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Person</TableHead>
          {STAFF_ROLES.map((role) => (
            <TableHead key={role} className="whitespace-normal">
              {STAFF_ROLE_LABELS[role]}
            </TableHead>
          ))}
          <TableHead>
            <span className="sr-only">Save</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <RoleRow key={member.userId} member={member} />
        ))}
      </TableBody>
    </Table>
  );
}

function sameRoles(a: readonly StaffRole[], b: readonly StaffRole[]): boolean {
  return a.length === b.length && a.every((role) => b.includes(role));
}

function RoleRow({ member }: { member: StaffMember }) {
  const setRoles = useMutation(api.atelier.staff.setRoles);
  const [roles, setLocalRoles] = useState<StaffRole[]>(member.roles);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !sameRoles(roles, member.roles);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const saved = await setRoles({ userId: member.userId, roles });
      setLocalRoles(saved.roles);
      toast.success(
        `${member.name}: ${saved.roles.length === 0 ? "no roles" : saved.roles.map((role) => STAFF_ROLE_LABELS[role]).join(", ")}.`,
      );
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <TableRow className="align-top">
      <TableCell className="whitespace-normal">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{member.name}</span>
          {member.email ? <span className="text-xs text-muted-foreground">{member.email}</span> : null}
          {member.isAdmin ? <span className="text-xs text-primary">Admin · holds every role</span> : null}
          {error ? <ErrorAlert title="The roles were not saved" message={error} className="mt-2" /> : null}
        </div>
      </TableCell>
      {STAFF_ROLES.map((role) => {
        const id = `role-${member.userId}-${role}`;
        return (
          <TableCell key={role}>
            <div className="flex min-h-7 items-center">
              <Checkbox
                id={id}
                checked={roles.includes(role)}
                aria-label={`${STAFF_ROLE_LABELS[role]} for ${member.name}`}
                onCheckedChange={(checked) =>
                  setLocalRoles((current) =>
                    checked
                      ? STAFF_ROLES.filter((candidate) => candidate === role || current.includes(candidate))
                      : current.filter((candidate) => candidate !== role),
                  )
                }
              />
            </div>
          </TableCell>
        );
      })}
      <TableCell>
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          className="h-8"
          disabled={pending || !dirty}
          onClick={() => void save()}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Gives a first role to an account found by email; the server refuses unknown roles and accounts. */
function AddStaffForm({ existing }: { existing: StaffMember[] }) {
  const setRoles = useMutation(api.atelier.staff.setRoles);
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<string | null>(null);
  const [roles, setLocalRoles] = useState<StaffRole[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const member = useQuery(api.admin.lookupMember, lookup ? { email: lookup } : "skip");
  const alreadyListed = member ? existing.some((entry) => entry.userId === member._id) : false;

  async function save(userId: Id<"users">) {
    setPending(true);
    setError(null);
    try {
      const saved = await setRoles({ userId, roles });
      toast.success(`${saved.name} now holds ${saved.roles.map((role) => STAFF_ROLE_LABELS[role]).join(", ")}.`);
      setEmail("");
      setLookup(null);
      setLocalRoles([]);
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4 border-t border-foreground/15 pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim()) setLookup(email.trim().toLowerCase());
      }}
    >
      <h3 className="text-base font-medium">Give someone a role</h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="sm:max-w-sm sm:flex-1">
          <FieldLabel htmlFor="staff-lookup-email">Account email</FieldLabel>
          <FieldDescription>The person must already have signed in to the members app once.</FieldDescription>
          <Input
            id="staff-lookup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-sm"
          />
        </Field>
        <Button type="submit" variant="outline" className="h-10 rounded-none px-4" disabled={email.trim().length === 0}>
          Find account
        </Button>
      </div>
      {lookup !== null ? (
        member === undefined ? (
          <p className="text-sm text-muted-foreground">Looking up {lookup}…</p>
        ) : member === null ? (
          <p className="text-sm text-warning">No account with that email has signed in yet.</p>
        ) : alreadyListed ? (
          <p className="text-sm text-muted-foreground">
            {member.name} is already listed above; change their roles there.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              {member.name} <Mono upper={false}>{member.email}</Mono>
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2" role="group" aria-label="Roles to give">
              {STAFF_ROLES.map((role) => {
                const id = `new-role-${role}`;
                return (
                  <div key={role} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={roles.includes(role)}
                      onCheckedChange={(checked) =>
                        setLocalRoles((current) =>
                          checked
                            ? STAFF_ROLES.filter((candidate) => candidate === role || current.includes(candidate))
                            : current.filter((candidate) => candidate !== role),
                        )
                      }
                    />
                    <Label htmlFor={id} className="text-sm font-normal">
                      {STAFF_ROLE_LABELS[role]}
                    </Label>
                  </div>
                );
              })}
            </div>
            {error ? <ErrorAlert title="The roles were not saved" message={error} /> : null}
            <Button
              type="button"
              className="h-10 rounded-none px-4"
              disabled={pending || roles.length === 0}
              onClick={() => void save(member._id)}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Save roles
            </Button>
          </div>
        )
      ) : null}
    </form>
  );
}
