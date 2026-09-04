import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "./utils.js";

/** How long the confirmation check replaces the copy icon, in ms. */
const COPIED_FEEDBACK_MS = 1500;

export interface CopyIconButtonProps {
  /** Text placed on the clipboard. The button renders nothing when it is empty. */
  value: string | null | undefined;
  /** Icon edge length in px — 12 sits inline with `text-[11px]` id text. */
  size?: number;
  /** Accessible name, also the hover title. */
  label?: string;
  className?: string;
}

/**
 * Bare copy-to-clipboard icon button: the icon swaps to a check for a moment on
 * success, so the user gets confirmation without a toast. Sits inline next to
 * ids and reference numbers.
 * @example <CopyIconButton value={submissionId} label="Copy authorization number" />
 */
export function CopyIconButton({
  value,
  size = 12,
  label = "Copy",
  className,
}: CopyIconButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  // A click landing after unmount (row navigated away) must not set state.
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const trimmed = value?.trim();
  if (!trimmed) return null;

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Ids often sit inside a clickable row or header — copying must not also
    // open or navigate it.
    event.stopPropagation();
    // Absent in insecure contexts; there is nothing useful to fall back to, so
    // the button simply stays in its idle state.
    void navigator.clipboard?.writeText(trimmed).then(
      () => {
        setCopied(true);
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      },
      () => {}
    );
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        "shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-primary dark:text-slate-500 dark:hover:text-primary-300",
        className
      )}
    >
      {copied ? (
        <Check size={size} className="text-emerald-500 dark:text-emerald-400" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  );
}
