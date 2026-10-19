import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A task section on an Operate screen: a plain heading, an optional line of guidance, one row of
 * actions, then the content. Sections are divided by hairlines, never boxed in cards.
 */
export function AtelierSection({
  id,
  title,
  description,
  actions,
  children,
  className,
  level = 2,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn("scroll-mt-24 border-t border-foreground/15 py-6 first:border-t-0 first:pt-0", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <Heading
            id={id ? `${id}-title` : undefined}
            className={cn("font-medium tracking-tight text-balance", level === 2 ? "text-xl sm:text-2xl" : "text-base")}
          >
            {title}
          </Heading>
          {description ? (
            <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

/** The one display line a screen gets: Bodoni Moda, balanced, never more than two lines. */
export function DisplayLine({
  children,
  className,
  as: Tag = "h1",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  return (
    <Tag
      className={cn(
        "font-display text-[34px] leading-[1.02] font-medium tracking-[-0.01em] text-balance sm:text-[48px] lg:text-[56px]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
