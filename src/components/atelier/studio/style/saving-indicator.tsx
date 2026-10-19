import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * "Saving…" beside the thing that is saving. The words carry the meaning; the spinner is decoration, and
 * the save itself is announced once by the core's save status, so this is not a second live region.
 */
export function SavingIndicator({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Spinner className="size-3" aria-hidden />
      Saving…
    </span>
  );
}
