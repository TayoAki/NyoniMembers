import {
  CreditCard,
  Images,
  LayoutGrid,
  Plus,
  Settings,
  Shirt,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { routes } from "@/lib/routes";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: routes.wardrobe, label: "Wardrobe", icon: Shirt },
  { href: routes.add, label: "Add pieces", icon: Plus },
  { href: routes.outfits, label: "Looks", icon: LayoutGrid },
  { href: routes.stylist, label: "Concierge", icon: Sparkles },
  { href: routes.lookbook, label: "Lookbook", icon: Images },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { href: routes.membership, label: "Membership", icon: CreditCard },
  { href: routes.settings, label: "Settings", icon: Settings },
  { href: routes.admin, label: "Admin", icon: ShieldCheck, adminOnly: true },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
