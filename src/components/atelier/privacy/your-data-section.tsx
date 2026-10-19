"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { signInHref, type Viewer } from "@/components/atelier/fit/fit-words";
import { PrivacyRows } from "@/components/atelier/privacy/privacy-skeleton";
import {
  CLOSE_ACCOUNT_WORDS,
  CLOSE_CONFIRM_WORD,
  EXPORT_WORDS,
  RECORDED_STEPS_SENTENCE,
} from "@/components/atelier/privacy/privacy-words";
import type { UsePrivacyRequest } from "@/components/atelier/privacy/use-privacy-request";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { routes } from "@/lib/routes";

type Props = { viewer: Viewer; privacy: UsePrivacyRequest };

/**
 * S34 · Your data (C27): the export, for anyone; closing the account, for the account's owner only, behind
 * a typed confirmation that lists exactly what runs and what the house keeps.
 */
export function YourDataSection({ viewer, privacy }: Props) {
  const exporting = privacy.pendingKind === "export";
  const exportFailure = privacy.failure?.kind === "export" ? privacy.failure.error : null;
  const closeFailure = privacy.failure?.kind === "close_account" ? privacy.failure.error : null;

  const requestExport = async () => {
    try {
      await privacy.submit("export");
    } catch (error) {
      reportError(error);
    }
  };

  return (
    <AtelierSection
      id="your-data"
      title="Your data"
      description="What you can take with you, and how the account itself is closed."
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <h3 className="text-base font-medium">Export</h3>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{EXPORT_WORDS}</p>
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            onClick={() => void requestExport()}
            disabled={exporting}
            aria-busy={exporting}
          >
            {exporting ? <Spinner data-icon="inline-start" aria-label="Sending your request" /> : null}
            {exporting ? "Requesting…" : "Export my data"}
          </Button>
          {exportFailure ? (
            <ErrorAlert
              title="Could not open the export request"
              message={exportFailure.message}
              onRetry={() => {
                privacy.clearFailure();
                void requestExport();
              }}
            />
          ) : null}
        </div>

        <div className="space-y-3 border-t border-foreground/10 pt-6">
          <h3 className="text-base font-medium">Close account</h3>
          {viewer.status === "loading" ? (
            <PrivacyRows count={1} />
          ) : viewer.status === "signed_out" ? (
            <div className="space-y-4">
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Closing an account needs that account: sign in to ask for it. This browser&rsquo;s photograph and
                designs can be removed above without one.
              </p>
              <Button
                variant="outline"
                className="h-11 rounded-none px-5"
                render={<Link href={signInHref(routes.atelier.privacy)} />}
                nativeButton={false}
              >
                Sign in
              </Button>
            </div>
          ) : (
            <CloseAccount privacy={privacy} />
          )}
          {closeFailure ? (
            <ErrorAlert
              title="Could not open the closure request"
              message={closeFailure.message}
              onRetry={privacy.clearFailure}
              retryLabel="Dismiss"
            />
          ) : null}
        </div>
      </div>
    </AtelierSection>
  );
}

function CloseAccount({ privacy }: { privacy: UsePrivacyRequest }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === CLOSE_CONFIRM_WORD;

  return (
    <div className="space-y-4">
      <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        {CLOSE_ACCOUNT_WORDS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped("");
        }}
        trigger={
          <Button variant="destructive" className="h-11 rounded-none px-5">
            Close my account
          </Button>
        }
        title="Close your account?"
        description={`Your export is written first; then photographs, previews and designs are removed as recorded steps, and a privacy staff member removes your sign-in. ${RECORDED_STEPS_SENTENCE}`}
        confirmLabel="Close my account"
        confirmDisabled={!confirmed}
        destructive
        onConfirm={() => privacy.submit("close_account")}
      >
        <Field>
          <FieldLabel htmlFor={`${id}-confirm`}>Type {CLOSE_CONFIRM_WORD} to confirm</FieldLabel>
          <Input
            id={`${id}-confirm`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 rounded-none font-mono tracking-[0.16em] uppercase"
          />
          <FieldDescription>
            Your requests to the house and the record of this request are kept as service and audit records.
          </FieldDescription>
        </Field>
      </ConfirmDialog>
    </div>
  );
}
