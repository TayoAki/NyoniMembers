import { Shirt } from "lucide-react";
import Link from "next/link";
import { routes } from "@/lib/routes";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#credits", label: "Credits" },
  { href: "#pricing", label: "Pricing" },
  { href: routes.signIn, label: "Sign in" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <Shirt className="size-4" aria-hidden />
            Fitcheck
          </p>
          <p className="text-muted-foreground text-xs">Your wardrobe, tagged, styled and rendered on you.</p>
        </div>
        <nav aria-label="Footer" className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
