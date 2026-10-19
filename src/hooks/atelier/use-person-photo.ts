"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { PersonPhotoView } from "@convex/atelier/photos";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { CONSENT_VERSION } from "@convex/shared/atelier/policy";
import { useGuestKeyArg, useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { imageUploadMimeType } from "@/lib/image-upload";

/** A photograph chosen in this browser: its object URL lives until `clear()` or a successful send. */
export type LocalPhoto = { file: File; url: string; width: number; height: number };

export type PhotoUploadState =
  | { phase: "idle" }
  | { phase: "reading" }
  /** Chosen and previewed locally; `guidance` lists what the house would refuse, so nothing is sent yet. */
  | { phase: "chosen"; local: LocalPhoto; guidance: string[] }
  | { phase: "sending"; local: LocalPhoto; progress: number }
  | { phase: "checking"; local: LocalPhoto }
  /** The server looked at the stored file and said no; the reasons are the retake guidance. */
  | { phase: "rejected"; local: LocalPhoto; reasons: string[] }
  | { phase: "failed"; local: LocalPhoto | null; error: ClientError };

export type UsePersonPhoto = {
  /** undefined while loading; null when this browser or account has no photograph. */
  photo: PersonPhotoView | null | undefined;
  upload: PhotoUploadState;
  /** Reads the file's dimensions and shows it locally. Sends nothing. */
  choose: (file: File) => Promise<void>;
  /** Uploads the chosen file and records it with the current consent version; resolves null on failure. */
  send: () => Promise<PersonPhotoView | null>;
  /** Drops the local file (Cancel, Retake). Nothing already stored is touched. */
  clear: () => void;
  remove: (photoId: Id<"atelierPersonPhotos">) => Promise<void>;
};

const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_MB = Math.round(ATELIER_LIMITS.maxPhotoBytes / (1024 * 1024));

/**
 * The checks the server will make that the browser can make first, with the same words, so an obvious
 * problem is caught before a large file leaves the device. The server's validation stays the authority.
 */
export function photoGuidance(file: Pick<File, "size">, width: number, height: number): string[] {
  const reasons: string[] = [];
  if (file.size > ATELIER_LIMITS.maxPhotoBytes) {
    reasons.push(`The photograph is larger than ${MAX_MB} MB. A smaller export of the same photograph works.`);
  }
  if (Math.min(width, height) < ATELIER_LIMITS.minPhotoEdgePx) {
    reasons.push(
      `The photograph is too small to work from: at least ${ATELIER_LIMITS.minPhotoEdgePx} pixels on each side.`,
    );
  }
  if (Math.max(width, height) > ATELIER_LIMITS.maxPhotoEdgePx) {
    reasons.push(`The photograph is too large on one side: at most ${ATELIER_LIMITS.maxPhotoEdgePx} pixels.`);
  }
  if (height <= width) {
    reasons.push("The photograph is wider than it is tall. A full-length portrait, head to shoes, works best.");
  }
  return reasons;
}

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // Some browsers cannot decode every format this way; the <img> route below reads the same file.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photograph could not be read. Please choose it again."));
    };
    image.src = url;
  });
}

type UploadResponse = { storageId?: string };

/** `fetch` cannot report upload progress, so the file goes up through XMLHttpRequest. */
function postFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url, true);
    request.timeout = UPLOAD_TIMEOUT_MS;
    request.setRequestHeader("Content-Type", imageUploadMimeType(file));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(0.99, event.loaded / event.total));
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("The photograph did not finish sending. Please try again."));
        return;
      }
      let body: UploadResponse;
      try {
        body = JSON.parse(request.responseText) as UploadResponse;
      } catch {
        reject(new Error("The photograph did not finish sending. Please try again."));
        return;
      }
      if (!body.storageId) {
        reject(new Error("The photograph did not finish sending. Please try again."));
        return;
      }
      onProgress(1);
      // The upload endpoint answers with the id of the file it just stored; there is no typed client for it.
      resolve(body.storageId as Id<"_storage">);
    });
    request.addEventListener("error", () =>
      reject(new Error("The photograph could not be sent. Check your connection and try again.")),
    );
    request.addEventListener("abort", () => reject(new Error("Sending was interrupted. Please try again.")));
    request.addEventListener("timeout", () =>
      reject(new Error("Sending timed out. Check your connection and try again.")),
    );
    try {
      request.send(file);
    } catch (error) {
      reject(error);
    }
  });
}

function localOf(state: PhotoUploadState): LocalPhoto | null {
  return "local" in state ? state.local : null;
}

/**
 * The one consented photograph behind a personal preview (C08, C11): what the server holds, and the
 * local file on its way there. Consent is recorded by `send`, with the version the client read; the
 * server validates the stored bytes and its reasons come back as retake guidance.
 */
export function usePersonPhoto(): UsePersonPhoto {
  const ownerArgs = useOwnerArgs({});
  const guestKeyArg = useGuestKeyArg();
  const photo = useQuery(api.atelier.photos.get, ownerArgs);
  const generateUploadUrl = useMutation(api.atelier.photos.generateUploadUrl);
  const register = useMutation(api.atelier.photos.register);
  const removeMutation = useMutation(api.atelier.photos.remove);

  const [upload, setUpload] = useState<PhotoUploadState>({ phase: "idle" });
  const urlRef = useRef<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);
  useEffect(() => releaseUrl, [releaseUrl]);

  const clear = useCallback(() => {
    releaseUrl();
    setUpload({ phase: "idle" });
  }, [releaseUrl]);

  const choose = useCallback(
    async (file: File) => {
      releaseUrl();
      setUpload({ phase: "reading" });
      try {
        const { width, height } = await readDimensions(file);
        const url = URL.createObjectURL(file);
        urlRef.current = url;
        setUpload({
          phase: "chosen",
          local: { file, url, width, height },
          guidance: photoGuidance(file, width, height),
        });
      } catch (error) {
        setUpload({ phase: "failed", local: null, error: toClientError(error) });
      }
    },
    [releaseUrl],
  );

  const send = useCallback(async (): Promise<PersonPhotoView | null> => {
    const local = localOf(upload);
    if (!local) return null;
    setUpload({ phase: "sending", local, progress: 0 });
    try {
      const url = await generateUploadUrl(guestKeyArg);
      const storageId = await postFile(url, local.file, (progress) => setUpload({ phase: "sending", local, progress }));
      setUpload({ phase: "checking", local });
      const view = await register({
        ...guestKeyArg,
        storageId,
        mimeType: imageUploadMimeType(local.file),
        width: local.width,
        height: local.height,
        consentVersion: CONSENT_VERSION,
      });
      releaseUrl();
      setUpload({ phase: "idle" });
      return view;
    } catch (error) {
      const failure = toClientError(error);
      const reasons = failure.details?.reasons;
      if (
        failure.code === "INVALID_INPUT" &&
        Array.isArray(reasons) &&
        reasons.every((reason) => typeof reason === "string")
      ) {
        setUpload({ phase: "rejected", local, reasons: reasons.length > 0 ? reasons : [failure.message] });
      } else if (failure.code === "INVALID_INPUT") {
        setUpload({ phase: "rejected", local, reasons: [failure.message] });
      } else {
        setUpload({ phase: "failed", local, error: failure });
      }
      return null;
    }
  }, [upload, generateUploadUrl, guestKeyArg, register, releaseUrl]);

  const remove = useCallback(
    async (photoId: Id<"atelierPersonPhotos">) => {
      await removeMutation({ ...guestKeyArg, photoId });
    },
    [guestKeyArg, removeMutation],
  );

  return { photo, upload, choose, send, clear, remove };
}
