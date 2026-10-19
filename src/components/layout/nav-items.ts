import {
  CreditCard,
  Images,
  LayoutGrid,
  Plus,
  Scissors,
  Settings,
  Shirt,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { routes } from "@/lib/routes";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Admins and anyone holding a staff role, as `staff.me` reports it. */
  staffOnly?: boolean;
};

export type NavAudience = { isAdmin: boolean; isStaff: boolean };

export function canSeeNavItem(item: NavItem, who: NavAudience): boolean {
  if (item.adminOnly && !who.isAdmin) return false;
  if (item.staffOnly && !who.isStaff) return false;
  return true;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: routes.wardrobe, label: "Wardrobe", icon: Shirt },
  { href: routes.add, label: "Add pieces", icon: Plus },
  { href: routes.outfits, label: "Looks", icon: LayoutGrid },
  { href: routes.stylist, label: "Concierge", icon: Sparkles },
  { href: routes.lookbook, label: "Lookbook", icon: Images },
  { href: routes.atelier.home, label: "Atelier", icon: Scissors },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { href: routes.membership, label: "Membership", icon: CreditCard },
  { href: routes.settings, label: "Settings", icon: Settings },
  { href: routes.admin, label: "Admin", icon: ShieldCheck, adminOnly: true },
  { href: routes.staffAtelier.queue, label: "Atelier desk", icon: Scissors, staffOnly: true },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
