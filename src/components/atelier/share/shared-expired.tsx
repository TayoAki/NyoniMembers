import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/** S17, expired or revoked: plain words and the way to the entry. Nothing private was ever in the link. */
export function SharedExpired() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Shared design</p>
      <DisplayLine>This link has expired.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The person who shared it can make a new one from their draft. A shared link only ever carries the design itself,
        never contact details, photographs or measurements.
      </p>
      <div>
        <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.home} />} nativeButton={false}>
          Design your own suit
        </Button>
      </div>
    </div>
  );
}
