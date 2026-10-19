import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The tailor's order book: ruled rows, a label at the left, the decision at the right, and the
 * production code in mono after it. The review step, receipts, quotes and the staff views all read
 * from this one component so the client and the house see the same words.
 */
export function OrderBook({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & Omit<React.ComponentProps<"dl">, "children">) {
  return (
    <dl className={cn("divide-y divide-foreground/10 border-y border-foreground/15", className)} {...props}>
      {children}
    </dl>
  );
}

type OrderBookRowProps = {
  label: ReactNode;
  value: ReactNode;
  /** Production id or supplier reference, set in mono at the end of the row. */
  code?: string | null;
  /** A quiet secondary line under the value (a warning, a note, "representative shade"). */
  note?: ReactNode;
  /** An inline action such as "Change" or "Edit"; keep it to one. */
  action?: ReactNode;
  tone?: "default" | "warning" | "muted";
  className?: string;
};

export function OrderBookRow({ label, value, code, note, action, tone = "default", className }: OrderBookRowProps) {
  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto] sm:items-baseline",
        className,
      )}
    >
      <dt className="text-xs font-medium tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-sm",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="min-w-0 break-words">{value}</span>
          {code ? (
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{code}</span>
          ) : null}
        </div>
        {note ? <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</div> : null}
      </dd>
      {action ? <dd className="sm:justify-self-end">{action}</dd> : null}
    </div>
  );
}

/** A section heading inside an order book: the garment part, set small and tracked. */
export function OrderBookSection({ children }: { children: ReactNode }) {
  return (
    <div className="pt-5 pb-1 first:pt-0">
      <h3 className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{children}</h3>
    </div>
  );
}
