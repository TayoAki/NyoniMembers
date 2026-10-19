import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function RequestNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <DisplayLine>This request could not be found.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may be incomplete, the request may belong to another browser or account, or it never existed. Your
        requests are listed under Requests; sign in if you sent this one from your account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.requests} />}
          nativeButton={false}
        >
          Your requests
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
