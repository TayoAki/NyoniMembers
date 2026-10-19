"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/atelier/common/status-line";
import { NO_CHECKOUT_SENTENCE, QUOTE_ACCEPTED_WORDS } from "@/components/atelier/requests/case-words";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { QuoteView } from "@convex/atelier/quotes";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

/** Error codes whose message is the final word: retrying the same acceptance cannot succeed. */
const FINAL_CODES: ReadonlySet<string> = new Set(["QUOTE_EXPIRED", "STALE_REVISION", "INVALID_STATE", "NOT_FOUND"]);

/**
 * C21: accepting the exact quote version. The dialog restates the house's final-sale rule and that
 * acceptance is not payment; success opens the commission and says "payment not yet recorded".
 */
export function QuoteAccept({ quote }: { quote: QuoteView }) {
  const router = useRouter();
  const guestKeyArg = useGuestKeyArg();
  const accept = useMutation(api.atelier.quotes.accept);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [orderId, setOrderId] = useState<Id<"atelierOrders"> | null>(null);

  async function confirm() {
    setError(null);
    try {
      const result = await accept({ ...guestKeyArg, quoteId: quote._id });
      setOrderId(result.orderId);
      toast.success(QUOTE_ACCEPTED_WORDS);
      router.push(routes.atelier.order(result.orderId));
    } catch (caught) {
      const clientError = toClientError(caught);
      toast.error(clientError.message);
      setError(clientError);
    }
  }

  if (orderId) {
    return (
      <div className="space-y-3 border-t border-foreground/15 pt-5" aria-live="polite">
        <StatusLine tone="success" live className="text-sm">
          {QUOTE_ACCEPTED_WORDS}
        </StatusLine>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your commission is open with the house. {NO_CHECKOUT_SENTENCE}
        </p>
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.order(orderId)} />}
          nativeButton={false}
        >
          See your commission
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-foreground/15 pt-5">
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Accepting opens your commission with the house for exactly this design at exactly this price. It is not a
        payment: the house records payment from its own system, and you will read “Payment confirmed” here only once it
        has.
      </p>
      {error ? (
        <ErrorAlert
          title="The quote was not accepted"
          message={error.message}
          onRetry={FINAL_CODES.has(error.code) ? undefined : () => setOpen(true)}
        />
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button className="h-11 rounded-none px-5" onClick={() => setOpen(true)}>
            Accept this quote
          </Button>
        }
        title={`Accept quote version ${quote.version} · ${formatUsd(quote.totalUsd)}?`}
        description="You are accepting this exact design at this exact price. Read the two sentences below before you do."
        confirmLabel="Accept the quote"
        cancelLabel="Not yet"
        onConfirm={confirm}
      >
        <div className="space-y-3 text-sm leading-relaxed">
          <p>{HOUSE_POLICY.verified.finalSale}</p>
          <p>Acceptance is not payment. {NO_CHECKOUT_SENTENCE}</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
