// src/components/CopyButton.tsx
"use client";
import * as React from "react";

export default function CopyButton({
  text,
  onCopied,
}: {
  text: string;
  onCopied?: () => void;
}) {
  async function handle() {
    try {
      await navigator.clipboard.writeText(text);
      onCopied?.();
    } catch {
      // ignored — page can show its own error toast if needed
    }
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
      aria-label="Copy caption to clipboard"
    >
      Copy
    </button>
  );
}
