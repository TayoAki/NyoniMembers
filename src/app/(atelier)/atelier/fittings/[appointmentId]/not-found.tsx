import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function AppointmentNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <DisplayLine>This fitting could not be found.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may be incomplete, the appointment may belong to another browser or account, or it never existed. Your
        fittings are listed under Fittings; sign in if you asked for this one from your account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.fittings} />}
          nativeButton={false}
        >
          Your fittings
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
