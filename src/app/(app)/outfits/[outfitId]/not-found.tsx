import Link from "next/link";
import { routes } from "@/lib/routes";

export default function OutfitNotFound() {
  return (
    <div className="mx-auto flex min-h-[320px] w-full max-w-md flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold tracking-tight">Outfit not found</h1>
      <p className="text-muted-foreground text-sm">It may have been deleted, or the link is wrong.</p>
      <Link
        href={routes.outfits}
        className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      >
        Back to outfits
      </Link>
    </div>
  );
}
