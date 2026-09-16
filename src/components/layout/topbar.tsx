"use client";

import { usePathname } from "next/navigation";
import { CreditBadge } from "@/components/common/credit-badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ActivityPopover } from "./activity-popover";
import { isActivePath, PRIMARY_NAV, SECONDARY_NAV } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const pathname = usePathname();
  const current = [...PRIMARY_NAV, ...SECONDARY_NAV].find((item) => isActivePath(pathname, item.href));
  return (
    <header
      className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="min-w-0 flex-1 truncate text-sm font-medium">{current?.label ?? ""}</div>
      <div className="flex items-center gap-1">
        <CreditBadge />
        <ActivityPopover />
        <ThemeToggle />
      </div>
    </header>
  );
}
