"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useGuestKeyArg, useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { OrderView } from "@convex/atelier/orders";

/**
 * S33 (C26): "Make this suit again" duplicates the design this commission was made from into a new
 * draft that names its source. The original stays in history untouched; the new draft's warnings say
 * whether the cloth is still available and the catalogue has moved on, and a new quote prices it.
 */
export function Reorder({ order }: { order: OrderView }) {
  const router = useRouter();
  const pathname = usePathname();
  const guestKeyArg = useGuestKeyArg();
  const { rememberDraft } = useAtelierSession();
  // OrderView carries no draftId; the request this commission came from does.
  const request = useQuery(api.atelier.cases.get, useOwnerArgs({ caseId: order.caseId }));
  const duplicate = useMutation(api.atelier.drafts.duplicate);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  const draftId = request?.draftId ?? null;
  const loading = request === undefined;

  async function makeAgain() {
    if (!draftId || pending) return;
    setPending(true);
    setError(null);
    try {
      const newId = await duplicate({ ...guestKeyArg, draftId, sourceOrderId: order._id });
      rememberDraft({ draftId: newId, name: `${request?.draftName ?? "Your suit"} (again)`, updatedAt: Date.now() });
      toast.success("A new draft was made from this suit. Availability and prices are checked again in the studio.");
      router.push(routes.atelier.design(newId));
    } catch (caught) {
      setError(toClientError(caught));
      setPending(false);
    }
  }

  return (
    <AtelierSection
      id="reorder"
      title="Make this suit again"
      description="A new draft starts from exactly this specification and names this commission as its source. The original stays in your history; availability and prices are checked again in the studio, and a discontinued cloth is shown as such, never swapped silently."
    >
      <div className="space-y-4">
        {error ? (
          <ErrorAlert
            title="A new draft was not made"
            message={
              error.code === "UNAUTHENTICATED" ? (
                <>
                  This commission belongs to an account.{" "}
                  <Link
                    href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                    className="underline underline-offset-4"
                  >
                    Sign in
                  </Link>{" "}
                  to make it again.
                </>
              ) : (
                error.message
              )
            }
            onRetry={
              error.code === "UNAUTHENTICATED" || error.code === "NOT_FOUND" ? undefined : () => void makeAgain()
            }
            className="rounded-none"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            onClick={() => void makeAgain()}
            disabled={pending || loading || !draftId}
            aria-busy={pending}
          >
            {pending ? <Spinner data-icon="inline-start" aria-label="Making a new draft" /> : null}
            {pending ? "Making a new draft…" : "Make this suit again"}
          </Button>
          {loading ? (
            <span className="text-xs text-muted-foreground" role="status">
              Finding the original design…
            </span>
          ) : !draftId ? (
            <span className="max-w-md text-xs leading-relaxed text-muted-foreground">
              The original design is not available to this browser or account, so it cannot be duplicated from here.
              Your concierge can start a new design from this specification.
            </span>
          ) : null}
        </div>
      </div>
    </AtelierSection>
  );
}
