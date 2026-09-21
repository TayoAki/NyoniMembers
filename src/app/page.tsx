import { auth } from "@clerk/nextjs/server";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/common/wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: { absolute: "Nyoni Members" },
  description: "The private members app of Nyoni Couture. Sign in to your wardrobe, measurements and concierge.",
};

const MEMBERSHIP_URL = "https://nyonicouture.com/membership/";

const SHOWROOMS = [
  { city: "Charlotte", address: "325 N Graham St" },
  { city: "Atlanta", address: "2955 Peachtree Rd" },
  { city: "Houston", address: "2301 Yorktown St, Suite 105" },
] as const;

/** Private front door: members sign in; everyone else is pointed at the house for membership. */
export default async function FrontDoor() {
  const { userId } = await auth();
  if (userId) redirect(routes.wardrobe);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1520px] items-center justify-between px-4 py-5 sm:px-8 lg:px-12">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col justify-center px-4 py-12 sm:px-8 lg:px-12">
        <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Nyoni Couture · Members
        </p>
        <h1 className="mt-5 max-w-4xl font-display text-[44px] leading-[0.98] font-medium tracking-[-0.01em] text-balance sm:text-[72px] lg:text-[92px]">
          Your wardrobe. Your measurements. <em className="font-normal italic">Your concierge.</em>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Every member starts with the Nyoni collection in their wardrobe. Build a look, preview it on your own photo,
          and ask the concierge what to wear.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href={routes.signIn}
            className="inline-flex h-12 items-center gap-2 rounded-none bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Sign in <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={MEMBERSHIP_URL}
            className="inline-flex h-12 items-center gap-2 border border-foreground/25 px-6 text-sm font-medium transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Become a member
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Signature, Prestige and Circle Elite members sign in with the email or phone the house has on file.
        </p>
      </main>
      <footer className="mx-auto w-full max-w-[1520px] border-t border-foreground/10 px-4 py-6 sm:px-8 lg:px-12">
        <ul className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {SHOWROOMS.map((showroom) => (
            <li key={showroom.city}>
              <span className="text-foreground">{showroom.city}</span> · {showroom.address}
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
