import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/** An invitation the server does not know, has been declined, or whose group has closed. */
export function InviteNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <DisplayLine>This invitation is not open.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may be incomplete, the invitation may have been declined or already accepted from another browser or
        account, or the group has been closed by the house. Ask the organizer for a new invitation. If you accepted it
        in this browser earlier, your design is under Drafts.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.home} />} nativeButton={false}>
          The Atelier
        </Button>
        <Link
          href={routes.atelier.drafts}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
        >
          Your drafts
        </Link>
      </div>
    </div>
  );
}
