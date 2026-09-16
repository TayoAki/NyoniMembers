"use client";

import { CircleStop, CornerDownLeft, Send } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type ComposerProps = {
  onSend: (message: string) => Promise<void>;
  onCancel: () => Promise<void>;
  isBusy: boolean;
  isResuming: boolean;
  placeholder?: string;
};

export function Composer({ onSend, onCancel, isBusy, isResuming, placeholder }: ComposerProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const disabled = isBusy || isResuming || sending;

  async function submit() {
    const message = value.trim();
    if (message.length === 0 || disabled) return;
    setValue("");
    setSending(true);
    try {
      await onSend(message);
    } finally {
      setSending(false);
      textarea.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit();
  }

  async function cancel() {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="bg-background/95 sticky bottom-0 -mx-4 border-t px-4 pt-3 pb-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3 sm:pb-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textarea}
          value={value}
          rows={1}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={isResuming ? "Catching up on this conversation…" : (placeholder ?? "Ask me what to wear…")}
          aria-label="Message the stylist"
          className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {isBusy ? (
          <Button variant="outline" size="icon" onClick={() => void cancel()} disabled={cancelling} aria-label="Stop">
            {cancelling ? <Spinner /> : <CircleStop />}
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={() => void submit()}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send"
          >
            {sending ? <Spinner /> : <Send />}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground mt-1.5 hidden items-center gap-1 px-2 text-xs sm:flex">
        <Kbd>
          <CornerDownLeft className="size-3" aria-hidden /> Enter
        </Kbd>
        to send, <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line
      </p>
    </div>
  );
}
