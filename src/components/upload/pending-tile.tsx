"use client";

import { AlertCircle, Check } from "lucide-react";
import { ItemImage } from "@/components/common/item-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/format";

export type PendingFile = {
  key: string;
  name: string;
  sizeBytes: number;
  previewUrl: string;
  error?: string;
};

/** A tile that exists before the server knows about the file: local preview plus real upload progress. */
export function PendingTile({ file, progress }: { file: PendingFile; progress: number }) {
  const percent = Math.round(progress * 100);
  const done = !file.error && percent >= 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ItemImage
            src={file.previewUrl}
            alt={file.name}
            variant="photo"
            aspect="aspect-square"
            className="size-12 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm">{file.name}</CardTitle>
            <p className="text-muted-foreground text-xs">{formatBytes(file.sizeBytes)}</p>
          </div>
          {file.error ? (
            <Badge variant="destructive">
              <AlertCircle aria-hidden />
              Failed
            </Badge>
          ) : done ? (
            <Badge variant="secondary" className="text-foreground">
              <Check className="text-success" aria-hidden />
              Uploaded
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-foreground">
              <Spinner className="size-3" aria-hidden />
              Uploading
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {file.error ? (
          <p className="text-destructive text-sm">{file.error}</p>
        ) : (
          <>
            <Progress value={percent} aria-label={`Uploading ${file.name}`} />
            <p className="text-muted-foreground text-xs tabular-nums">
              {done ? "Waiting for the queue…" : `${percent}% uploaded`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
