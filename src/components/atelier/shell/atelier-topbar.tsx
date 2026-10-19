"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/common/wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isActivePath } from "@/components/layout/nav-items";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const NAV = [
  { href: routes.atelier.home, label: "Design", exact: true },
  { href: routes.atelier.drafts, label: "Drafts" },
  { href: routes.atelier.requests, label: "Requests" },
  { href: routes.atelier.orders, label: "Orders" },
  { href: routes.atelier.fit, label: "Fit" },
  { href: routes.atelier.privacy, label: "Privacy" },
] as const;

function active(pathname: string, item: (typeof NAV)[number]): boolean {
  if ("exact" in item && item.exact)
    return pathname === item.href || pathname.startsWith(`${routes.atelier.home}/design`);
  return isActivePath(pathname, item.href);
}

export function AtelierTopbar() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1520px] items-center gap-4 px-4 sm:h-[72px] sm:px-8 lg:px-12">
          <Link
            href={routes.atelier.home}
            aria-label="Nyoni Atelier home"
            className="flex min-h-11 shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <Wordmark caption={false} />
            <span className="ml-2 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">Atelier</span>
          </Link>
          <nav aria-label="Atelier navigation" className="ml-auto hidden h-full items-center gap-6 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(pathname, item) ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center text-[13px] font-medium whitespace-nowrap transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4",
                  active(pathname, item)
                    ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-2">
            <ThemeToggle />
            <Show when="signed-out">
              <Link
                href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                className="inline-flex h-9 items-center border border-foreground/25 px-4 text-[13px] font-medium transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                Sign in
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href={routes.wardrobe}
                className="hidden h-9 items-center px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                Members
              </Link>
              <UserButton
                appearance={{
                  elements: { avatarBox: "size-8", userButtonTrigger: "size-11 justify-center sm:size-8" },
                }}
              />
            </Show>
          </div>
        </div>
      </header>
      <nav
        aria-label="Atelier navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-foreground/10 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(pathname, item) ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 items-center justify-center border-t-2 px-1 text-[11px] font-medium",
              active(pathname, item) ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
