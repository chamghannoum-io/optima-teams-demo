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
import { cn } from "./utils.js";

// ── Variant Config ───────────────────────────────────────────────────────

type ConfirmationVariant = "warning" | "delete" | "info" | "success";

interface VariantConfig {
  icon: React.ReactNode;
  /** Tailwind classes for the icon wrapper background */
  iconBg: string;
  /** Tailwind classes for the gradient glow at top of dialog */
  glowColor: string;
  /** Default confirm button label */
  defaultConfirmLabel: string;
  /** Button variant for the confirm action */
  confirmButtonVariant: "primary" | "destructive";
}

const WarningIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
    />
  </svg>
);

const DeleteIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const InfoIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SuccessIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const VARIANT_CONFIG: Record<ConfirmationVariant, VariantConfig> = {
  warning: {
    icon: <WarningIcon />,
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    glowColor: "from-amber-500/15 dark:from-amber-500/10",
    defaultConfirmLabel: "Confirm",
    confirmButtonVariant: "primary",
  },
  delete: {
    icon: <DeleteIcon />,
    iconBg: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    glowColor: "from-red-500/15 dark:from-red-500/10",
    defaultConfirmLabel: "Delete",
    confirmButtonVariant: "destructive",
  },
  info: {
    icon: <InfoIcon />,
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    glowColor: "from-blue-500/15 dark:from-blue-500/10",
    defaultConfirmLabel: "Confirm",
    confirmButtonVariant: "primary",
  },
  success: {
    icon: <SuccessIcon />,
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    glowColor: "from-emerald-500/15 dark:from-emerald-500/10",
    defaultConfirmLabel: "Confirm",
    confirmButtonVariant: "primary",
  },
};

// ── Props ────────────────────────────────────────────────────────────────

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ConfirmationVariant;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isConfirmDisabled?: boolean;
  children?: React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────

export function ConfirmationDialog({
  open,
  onOpenChange,
  variant,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isConfirmDisabled,
  children,
}: ConfirmationDialogProps) {
  const config = VARIANT_CONFIG[variant];

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] overflow-hidden p-0" hideCloseButton>
        {/* Gradient glow effect at top */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent opacity-80",
            config.glowColor
          )}
          aria-hidden
        />

        {/* Content */}
        <div className="relative flex flex-col items-center px-6 pt-6 pb-5 text-center">
          {/* Icon */}
          <div
            className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", config.iconBg)}
          >
            {config.icon}
          </div>

          {/* Title */}
          <DialogHeader className="mt-5 items-center border-0 p-0">
            <DialogTitle className="text-base font-semibold leading-snug">{title}</DialogTitle>
            {message && (
              <DialogDescription className="mt-2 max-w-[300px] text-sm leading-relaxed">
                {message}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Optional custom children */}
          {children && <div className="mt-4 w-full">{children}</div>}

          {/* Actions */}
          <DialogFooter className="mt-6 w-full flex-col gap-2.5 sm:flex-col border-0 p-0">
            <Button
              variant={config.confirmButtonVariant}
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className="w-full rounded-3xl h-12"
            >
              {confirmLabel ?? config.defaultConfirmLabel}
            </Button>
            <Button variant="secondary" onClick={handleCancel} className="w-full rounded-3xl h-12">
              {cancelLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
