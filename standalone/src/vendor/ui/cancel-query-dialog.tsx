import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog.js";
import { Button } from "./button.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./select.js";
import { Textarea } from "./textarea.js";
import { cn } from "./utils.js";

const OTHER_VALUE = "__other__";
const MAX_CUSTOM_REASON_LENGTH = 150;

export interface CancelQueryReason {
  id?: string | null;
  code?: string | null;
  display?: string | null;
}

export interface CancelQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: CancelQueryReason[];
  reasonsLoading?: boolean;
  cancelling?: boolean;
  onConfirm: (reason: string) => void;
  overlayClassName?: string;
  contentClassName?: string;
}

export function CancelQueryDialog({
  open,
  onOpenChange,
  reasons,
  reasonsLoading,
  cancelling,
  onConfirm,
  overlayClassName,
  contentClassName,
}: CancelQueryDialogProps) {
  const [selectedReason, setSelectedReason] = React.useState("");
  const [customReason, setCustomReason] = React.useState("");

  const hasOtherReason = reasons.some((r) => (r.display ?? r.code ?? "").toLowerCase() === "other");
  const isOther = selectedReason === OTHER_VALUE;
  const confirmValue = isOther ? customReason.trim() : selectedReason;
  const isCustomReasonTooLong = customReason.length > MAX_CUSTOM_REASON_LENGTH;
  const isConfirmDisabled = !confirmValue || cancelling || (isOther && isCustomReasonTooLong);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedReason("");
      setCustomReason("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-[420px] overflow-hidden p-0", contentClassName)}
        overlayClassName={overlayClassName}
        hideCloseButton
      >
        {/* Gradient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-red-500/15 to-transparent opacity-80 dark:from-red-500/10"
          aria-hidden
        />

        {/* Content */}
        <div className="relative flex flex-col items-center px-6 pt-6 pb-5 text-center">
          {/* Icon — Ban / circle-slash */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M4.93 4.93l14.14 14.14" />
            </svg>
          </div>

          {/* Header */}
          <DialogHeader className="mt-5 items-center border-0 p-0">
            <DialogTitle className="text-base font-semibold leading-snug">Cancel Query</DialogTitle>
            <DialogDescription className="mt-2 max-w-[300px] text-sm leading-relaxed">
              Are you sure you want to cancel this query? Please provide a reason.
            </DialogDescription>
          </DialogHeader>

          {/* Form */}
          <div className="mt-5 w-full text-start">
            {reasonsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-red-500 dark:border-dark-border dark:border-t-red-400" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Cancellation Reason
                  </label>
                  <Select
                    value={selectedReason}
                    onValueChange={(v) => {
                      setSelectedReason(v);
                      if (v !== OTHER_VALUE) setCustomReason("");
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select cancellation reason..." />
                    </SelectTrigger>
                    <SelectContent className="z-[130]">
                      {reasons.map((reason) => {
                        const display = reason.display ?? reason.code ?? "";
                        const isOtherOption = display.toLowerCase() === "other";
                        return (
                          <SelectItem
                            key={reason.id ?? reason.code ?? ""}
                            value={isOtherOption ? OTHER_VALUE : display}
                          >
                            {display}
                          </SelectItem>
                        );
                      })}
                      {!hasOtherReason && <SelectItem value={OTHER_VALUE}>Other</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {isOther && (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Reason
                    </label>
                    <Textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter cancellation reason..."
                      rows={3}
                      className={cn(
                        "resize-none text-sm",
                        isCustomReasonTooLong &&
                        "border-red-300 focus-visible:ring-red-500/20 dark:border-red-500/50"
                      )}
                      autoFocus
                    />
                    <div className="mt-1 flex items-center justify-between">
                      {isCustomReasonTooLong ? (
                        <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                          Maximum length is {MAX_CUSTOM_REASON_LENGTH} characters
                        </p>
                      ) : (
                        <span />
                      )}
                      <p
                        className={cn(
                          "text-[11px] tabular-nums",
                          isCustomReasonTooLong
                            ? "font-medium text-red-600 dark:text-red-400"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        {customReason.length}/{MAX_CUSTOM_REASON_LENGTH}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <DialogFooter className="mt-6 w-full flex-col gap-2.5 sm:flex-col border-0 p-0">
            <Button
              variant="destructive"
              onClick={() => onConfirm(confirmValue)}
              disabled={isConfirmDisabled}
              className="w-full rounded-3xl h-12 gap-2"
            >
              {cancelling ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {cancelling ? "Cancelling..." : "Confirm Cancel"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-3xl h-12"
            >
              Back
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
