"use client";

import { UserButton } from "@clerk/nextjs";
import { Shirt } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { routes } from "@/lib/routes";
import { isActivePath, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-items";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={isActivePath(pathname, item.href)}
        tooltip={item.label}
      >
        <item.icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={routes.wardrobe} />} size="lg" tooltip="Fitcheck">
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                <Shirt className="size-4" />
              </span>
              <span className="font-semibold tracking-tight">Fitcheck</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{PRIMARY_NAV.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{SECONDARY_NAV.filter((item) => !item.adminOnly || isAdmin).map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">
          <UserButton appearance={{ elements: { avatarBox: "size-7" } }} />
          <div className="min-w-0 text-xs group-data-[collapsible=icon]:hidden">
            <div className="truncate font-medium">{user?.name ?? "Your account"}</div>
            <div className="text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
