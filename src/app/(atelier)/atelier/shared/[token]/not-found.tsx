import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function SharedDesignNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Shared design</p>
      <DisplayLine>This design could not be found.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may have been copied incompletely, or it never existed. Ask the person who shared it for a fresh one.
      </p>
      <div>
        <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.home} />} nativeButton={false}>
          Design your own suit
        </Button>
      </div>
    </div>
  );
}
