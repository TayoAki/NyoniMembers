"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { routes } from "@/lib/routes";

/**
 * Sends users without an avatar to onboarding and keeps onboarded users out of it.
 * Renders a page-shaped skeleton while the user record loads so there's never a flash of the wrong screen.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const onOnboarding = pathname.startsWith(routes.onboarding);
  const needsOnboarding = Boolean(user && !user.onboardedAt);

  useEffect(() => {
    if (isLoading || !user) return;
    if (needsOnboarding && !onOnboarding) router.replace(routes.onboarding);
    if (!needsOnboarding && onOnboarding) router.replace(routes.wardrobe);
  }, [isLoading, user, needsOnboarding, onOnboarding, router]);

  if (isLoading || !user || (needsOnboarding && !onOnboarding) || (!needsOnboarding && onOnboarding)) {
    return <PageSkeleton />;
  }
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
