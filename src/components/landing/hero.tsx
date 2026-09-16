import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/format";
import { routes } from "@/lib/routes";
import { PLANS } from "@convex/shared/credits";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,var(--credit)_0%,transparent_70%)] opacity-15 dark:opacity-25"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Badge variant="outline" className="h-6 gap-1.5 rounded-full px-3 text-[0.7rem]">
            <Sparkles className="text-credit" aria-hidden />
            {formatCredits(PLANS.free.signupCredits)} free when you sign up
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Your wardrobe, <span className="text-muted-foreground">on you</span>, before you get dressed.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-base text-pretty sm:text-lg">
            Photograph the clothes you already own and Fitcheck cuts out every item, tags it, builds outfits with you,
            and renders you actually wearing them.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button size="lg" className="h-10 px-5" render={<Link href={routes.signUp} />}>
              Start free
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
            <Button size="lg" variant="outline" className="h-10 px-5" render={<Link href={routes.signIn} />}>
              Sign in
            </Button>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            No card needed. One credit is one image — nothing else is metered.
          </p>
        </div>
      </div>
    </section>
  );
}
