"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { StaffStatus } from "@convex/atelier/staff";
import { STAFF_ROLE_LABELS, type StaffRole } from "@convex/shared/atelier/enums";

/**
 * The Atelier desk: every staff surface under /admin/atelier shares this frame. One H1 from PageHeader,
 * then the desk's destinations as a quiet strip, then the page. Dense Operate mode: hairlines, no cards
 * nested in cards, the same vocabulary the client reads (DESIGN.md → "Staff surfaces").
 */

export const DESK_LINKS = [
  { href: routes.staffAtelier.queue, label: "Queue", also: ["/admin/atelier/cases"] },
  { href: routes.staffAtelier.catalogue, label: "Catalogue" },
  { href: routes.staffAtelier.fit, label: "Fit" },
  { href: routes.staffAtelier.quotes, label: "Quotes" },
  { href: routes.staffAtelier.production, label: "Production" },
  { href: routes.staffAtelier.previews, label: "Previews" },
  { href: routes.staffAtelier.aftercare, label: "Aftercare" },
  { href: routes.staffAtelier.privacy, label: "Privacy" },
] as const;

function isActive(pathname: string, link: (typeof DESK_LINKS)[number]): boolean {
  if (link.href === routes.staffAtelier.queue) {
    return pathname === link.href || ("also" in link && link.also.some((prefix) => pathname.startsWith(prefix)));
  }
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** The desk's destinations. Scrolls sideways on phones instead of wrapping into a second row. */
export function StaffDeskNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Atelier desk"
      className={cn(
        "-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto border-y border-foreground/15 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {DESK_LINKS.map((link) => {
        const active = isActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors first:pl-0 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "text-foreground" : "text-muted-foreground",
              active &&
                "after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:bg-primary first:after:left-0",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

type StaffShellProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

/** PageHeader + desk strip + the page. Loading skeletons render inside it so the structure never jumps. */
export function StaffShell({ title, description, actions, children }: StaffShellProps) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader title={title} description={description} actions={actions} />
      <StaffDeskNav />
      {children}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Roles
// ------------------------------------------------------------------------------------------------

export type StaffRoleRequirement = StaffRole | readonly StaffRole[];

export type StaffStanding =
  { status: "loading"; me: null } | { status: "signed_out"; me: null } | { status: "ready"; me: StaffStatus | null };

/** Who is at the desk, from `staff.me`. Admins hold every role; the server re-checks on every call. */
export function useStaffStanding(): StaffStanding {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.atelier.staff.me, isAuthenticated ? {} : "skip");
  if (isLoading) return { status: "loading", me: null };
  if (!isAuthenticated) return { status: "signed_out", me: null };
  if (me === undefined) return { status: "loading", me: null };
  return { status: "ready", me };
}

export function hasStaffRole(me: StaffStatus | null | undefined, role?: StaffRoleRequirement): boolean {
  if (!me) return false;
  if (me.isAdmin) return true;
  if (role === undefined) return me.isStaff;
  const wanted = typeof role === "string" ? [role] : role;
  return wanted.some((candidate) => me.roles.includes(candidate));
}

export function roleWords(role: StaffRoleRequirement): string {
  const wanted = typeof role === "string" ? [role] : role;
  return wanted.map((candidate) => STAFF_ROLE_LABELS[candidate]).join(" or ");
}

/** The FORBIDDEN state as a page, with the role named and the way to get it. */
export function StaffForbidden({ role, signedOut = false }: { role?: StaffRoleRequirement; signedOut?: boolean }) {
  return (
    <EmptyState
      icon={ShieldOff}
      title={signedOut ? "Sign in to use the desk" : role ? `This needs the ${roleWords(role)} role` : "Staff only"}
      description={
        signedOut
          ? "The Atelier desk is for the house's own people. Sign in with your staff account."
          : "Roles are set by an admin under Privacy → Staff roles. The server enforces the same rule on every action, so nothing here can be worked around."
      }
      action={
        <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.queue} />}>
          Back to the queue
        </Button>
      }
    />
  );
}

/** Keeps a block's shape while the standing is unknown, so a page never flashes "forbidden" on first paint. */
export function StaffGateSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Checking your role">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-sm" />
      ))}
    </div>
  );
}

/**
 * Renders its children only for staff holding the role (or an admin). While the standing loads it shows
 * `fallback` (a skeleton that keeps the page's structure); otherwise the forbidden state.
 */
export function StaffRoleGate({
  role,
  fallback,
  children,
}: {
  role?: StaffRoleRequirement;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const standing = useStaffStanding();
  if (standing.status === "loading") return <>{fallback ?? <StaffGateSkeleton />}</>;
  if (standing.status === "signed_out") return <StaffForbidden role={role} signedOut />;
  if (!hasStaffRole(standing.me, role)) return <StaffForbidden role={role} />;
  return <>{children}</>;
}
