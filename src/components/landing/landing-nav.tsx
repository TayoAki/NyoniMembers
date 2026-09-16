import { Shirt } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export function LandingNav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={routes.home} className="flex items-center gap-2 font-medium tracking-tight">
          <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
            <Shirt className="size-4" aria-hidden />
          </span>
          Fitcheck
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href={routes.signIn} />}>
            Sign in
          </Button>
          <Button size="sm" render={<Link href={routes.signUp} />}>
            Get started
          </Button>
        </div>
      </nav>
    </header>
  );
}
