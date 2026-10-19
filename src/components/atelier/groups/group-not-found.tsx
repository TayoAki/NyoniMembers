import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/** The organizer-only page for an id the server refused or does not know; also the route's not-found. */
export function GroupNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <DisplayLine>This group could not be found.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may be incomplete, the group may be organized from another account, or it never existed. Groups you
        organize are listed under Groups; sign in with the account that made this one. If you were invited to a group,
        open the invitation link the organizer sent you instead.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.groups} />} nativeButton={false}>
          Your groups
        </Button>
        <Link
          href={routes.atelier.home}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
        >
          The Atelier
        </Link>
      </div>
    </div>
  );
}
