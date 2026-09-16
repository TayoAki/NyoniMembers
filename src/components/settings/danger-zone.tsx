"use client";

import { useClerk } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

const CONFIRM_PHRASE = "DELETE";

export function DangerZone() {
  const deleteAllData = useMutation(api.users.deleteAllData);
  const { signOut } = useClerk();
  const [typed, setTyped] = useState("");

  async function handleDelete() {
    await deleteAllData({ confirm: CONFIRM_PHRASE });
    await signOut({ redirectUrl: routes.home });
  }

  return (
    <Card className="ring-destructive/30">
      <CardHeader className="border-destructive/20 border-b">
        <CardTitle className="text-destructive flex items-center gap-2">
          <TriangleAlert className="size-4" aria-hidden />
          Danger zone
        </CardTitle>
        <CardDescription>
          Deleting removes your wardrobe, outfits, renders, avatars, threads and credit history, and the files behind
          them. It cannot be undone and nothing is refunded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmDialog
          trigger={<Button variant="destructive">Delete everything</Button>}
          title="Delete everything?"
          description="Every item, outfit, render, avatar and ledger line is erased, then you are signed out. There is no way back."
          confirmLabel="Delete everything"
          destructive
          confirmDisabled={typed.trim() !== CONFIRM_PHRASE}
          onOpenChange={(open) => !open && setTyped("")}
          onConfirm={handleDelete}
        >
          <Field>
            <FieldLabel htmlFor="confirm-delete">Type {CONFIRM_PHRASE} to confirm</FieldLabel>
            <Input
              id="confirm-delete"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={CONFIRM_PHRASE}
            />
            <FieldDescription>
              This wipes your account data. Your sign-in stays, so you can start again.
            </FieldDescription>
          </Field>
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
