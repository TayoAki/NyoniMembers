"use client";

import { useMutation, useQuery } from "convex/react";
import { ImagePlus, Star, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { LoadingGrid } from "@/components/common/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUpload } from "@/hooks/use-upload";
import { reportError, toClientError } from "@/lib/errors";
import { formatBytes, formatPercent, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PLANS } from "@convex/shared/credits";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@convex/shared/wardrobe";

const ACCEPT = Object.entries(ACCEPTED_IMAGE_TYPES)
  .flatMap(([mime, extensions]) => [mime, ...extensions])
  .join(",");

function labelFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .slice(0, 40)
    .trim();
}

const AVATAR_UPLOAD_KEY = "avatar";

export function AvatarsSettings() {
  const avatars = useQuery(api.avatars.list, {});
  const { user } = useCurrentUser();
  const { upload, progress: uploadProgress, isUploading } = useUpload("avatars");
  const createAvatar = useMutation(api.avatars.create);
  const setDefault = useMutation(api.avatars.setDefault);
  const removeAvatar = useMutation(api.avatars.remove);

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingDefaultId, setPendingDefaultId] = useState<Id<"avatars"> | null>(null);

  const plan = user ? PLANS[user.balance.plan] : null;
  const atLimit = plan !== null && avatars !== undefined && avatars.length >= plan.maxAvatars;
  const uploading = isUploading;
  const progress = uploading ? (uploadProgress[AVATAR_UPLOAD_KEY] ?? 0) : null;

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;
    if (!(file.type in ACCEPTED_IMAGE_TYPES)) {
      toast.error("That file type is not supported. Use a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`Photos must be under ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setUploadError(null);
    try {
      const storageId = await upload(file, AVATAR_UPLOAD_KEY);
      const label = labelFromFileName(file.name);
      await createAvatar(label ? { storageId, label } : { storageId });
      toast.success("Photo added.");
    } catch (error) {
      setUploadError(toClientError(error).message);
      reportError(error, "Could not add that photo.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleSetDefault(avatarId: Id<"avatars">) {
    setPendingDefaultId(avatarId);
    try {
      await setDefault({ avatarId });
    } catch (error) {
      reportError(error, "Could not change the default photo.");
    } finally {
      setPendingDefaultId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Photos of you</CardTitle>
        <CardDescription>
          Renders are built from these photos. One clear, full-length shot against a plain background beats five blurry
          ones.
          {plan && avatars ? (
            <span className="ml-1 tabular-nums">
              {avatars.length} of {plan.maxAvatars} used on {plan.name}.
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {uploadError ? (
          <ErrorAlert
            title="That photo did not upload"
            message={uploadError}
            onRetry={() => inputRef.current?.click()}
            retryLabel="Pick another photo"
          />
        ) : null}

        {avatars === undefined ? (
          <LoadingGrid count={3} className="lg:grid-cols-4 xl:grid-cols-4" withCaption={false} />
        ) : avatars.length === 0 ? (
          <EmptyState
            className="min-h-0 py-8"
            icon={ImagePlus}
            title="No photos of you yet"
            description="Add at least one so outfits can be rendered on you."
            action={
              <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
                <ImagePlus data-icon="inline-start" aria-hidden />
                Add a photo
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {avatars.map((avatar) => (
              <li key={avatar._id} className="space-y-2">
                <div className="relative">
                  <ItemImage src={avatar.url} alt={avatar.label} variant="photo" />
                  {avatar.isDefault ? (
                    <Badge className="absolute top-2 left-2 gap-1">
                      <Star className="fill-current" aria-hidden />
                      Default
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium" title={avatar.label}>
                  {avatar.label}
                </p>
                <div className="flex items-center gap-1">
                  {avatar.isDefault ? (
                    <span className="text-muted-foreground flex-1 text-xs">Used by default</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="xs"
                      className="flex-1"
                      disabled={pendingDefaultId !== null}
                      onClick={() => void handleSetDefault(avatar._id)}
                    >
                      Make default
                    </Button>
                  )}
                  <ConfirmDialog
                    destructive
                    title="Remove this photo?"
                    description="Renders you have already made keep working. The photo itself is deleted for good."
                    confirmLabel="Remove"
                    onConfirm={() => removeAvatar({ avatarId: avatar._id })}
                    trigger={
                      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${avatar.label}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {atLimit && plan ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
            All {pluralize(plan.maxAvatars, "photo")} on the {plan.name} plan are in use. Remove one, or{" "}
            <Link href={routes.billing} className="hover:text-foreground underline underline-offset-2">
              move to a bigger plan
            </Link>
            .
          </p>
        ) : (
          <label
            htmlFor="avatar-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
              "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-3",
              dragging ? "border-ring bg-muted/60" : "hover:bg-muted/40",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            <input
              ref={inputRef}
              id="avatar-file"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={uploading}
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <UploadCloud className="text-muted-foreground size-5" aria-hidden />
            <span className="text-sm font-medium">Drop a photo here, or click to choose</span>
            <span className="text-muted-foreground text-xs">
              JPEG, PNG or WebP · up to {formatBytes(MAX_UPLOAD_BYTES)}
            </span>
          </label>
        )}

        {progress !== null ? (
          <div className="space-y-1.5" aria-live="polite">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Uploading photo…</span>
              <span className="tabular-nums">{formatPercent(progress)}</span>
            </div>
            <Progress value={Math.round(progress * 100)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
