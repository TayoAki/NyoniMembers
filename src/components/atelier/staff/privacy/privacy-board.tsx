"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { StaffRoleGate, StaffShell, useStaffStanding } from "@/components/atelier/staff/staff-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLog } from "./audit-log";
import { PrivacyQueue } from "./privacy-queue";
import { PrivacySkeleton } from "./privacy-skeleton";
import {
  isPrivacyTab,
  PRIVACY_DESCRIPTION,
  PRIVACY_TAB_LABELS,
  PRIVACY_TABS,
  PRIVACY_TITLE,
  type PrivacyTab,
} from "./privacy-words";
import { StaffRoles } from "./staff-roles";

const TAB_DESCRIPTIONS: Record<PrivacyTab, string> = {
  requests:
    "Open requests, oldest first. Each runs as named steps; the status is a reading of the steps, never a promise.",
  roles: "Who holds which role. Admins hold every role and are the only people who can change them.",
  audit: "What the house's people did, newest first. Every staff action in the Atelier writes a row.",
};

/** A08 (O08): requests, roles and the audit log under one frame. `?tab=` names the tab. Needs the privacy role. */
export function PrivacyBoard() {
  return (
    <StaffShell title={PRIVACY_TITLE} description={PRIVACY_DESCRIPTION}>
      <StaffRoleGate role="privacy" fallback={<PrivacySkeleton />}>
        <PrivacyTabs />
      </StaffRoleGate>
    </StaffShell>
  );
}

function PrivacyTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const standing = useStaffStanding();
  const requested = searchParams.get("tab");
  const [tab, setTabState] = useState<PrivacyTab>(isPrivacyTab(requested) ? requested : "requests");

  const setTab = useCallback(
    (next: PrivacyTab) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = String(value);
        if (isPrivacyTab(next)) setTab(next);
      }}
      className="gap-6"
    >
      <TabsList
        variant="line"
        aria-label="Privacy desk"
        className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
      >
        {PRIVACY_TABS.map((entry) => (
          <TabsTrigger
            key={entry}
            value={entry}
            className="h-11 flex-none px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
          >
            {PRIVACY_TAB_LABELS[entry]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={tab} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{TAB_DESCRIPTIONS[tab]}</p>
        {tab === "requests" ? <PrivacyQueue /> : null}
        {tab === "roles" ? (
          standing.status === "ready" ? (
            <StaffRoles me={standing.me} />
          ) : (
            <PrivacySkeleton rows={3} />
          )
        ) : null}
        {tab === "audit" ? <AuditLog /> : null}
      </TabsContent>
    </Tabs>
  );
}
