"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Reads `?checkout=success|cancelled` that Stripe redirects back to, toasts once,
 * then cleans the URL so a refresh does not re-announce it.
 * Must be rendered inside a `<Suspense>` boundary (it uses `useSearchParams`).
 */
export function CheckoutResult() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const announced = useRef(false);
  const outcome = searchParams.get("checkout");

  useEffect(() => {
    if (!outcome || announced.current) return;
    announced.current = true;
    if (outcome === "success") {
      toast.success("Credits added.", { description: "Your pack credits are on your balance and never expire." });
    } else if (outcome === "cancelled") {
      toast.info("Checkout cancelled.", { description: "Nothing was charged." });
    }
    router.replace(pathname);
  }, [outcome, pathname, router]);

  return null;
}
