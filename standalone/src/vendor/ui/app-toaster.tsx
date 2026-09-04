"use client";

import { Toaster, toast as sonnerToast } from "sonner";
import type { ToasterProps } from "sonner";

export interface AppToasterProps {
  /** Override position (Admin uses a user preference). Default "top-right". */
  position?: ToasterProps["position"];
  /** Override default duration (Admin uses a user preference). Default 3000. */
  duration?: number;
  /**
   * Distance from the viewport edges. Pass an object (`{ bottom: 88 }`) to clear a
   * floating element parked in the same corner, e.g. the support widget.
   */
  offset?: ToasterProps["offset"];
}

export function AppToaster({ position = "top-right", duration = 3000, offset }: AppToasterProps) {
  return (
    <Toaster
      richColors
      closeButton
      position={position}
      duration={duration}
      offset={offset}
      expand={false}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          // Make room on the right edge for the close button.
          toast: "!pr-10",
          // Polished "x" close button — anchored INSIDE the toast, top-right,
          // overriding sonner's default off-corner translate.
          closeButton: [
            // Position: kill sonner's transform, anchor top-right inside the toast
            "![transform:none] !left-auto !right-3 !top-3",
            // Shape & size
            "!size-6 !rounded-md !border-0",
            // Background: subtle tint that adapts to richColor backgrounds
            "!bg-black/10 dark:!bg-white/15",
            // Icon color inherits the toast's text color
            "!text-current",
            // Inner X svg sizing — was tiny by default
            "[&>svg]:!size-3.5 [&>svg]:!stroke-[2.5]",
            // Clear hover feedback (color only, no scale)
            "hover:!bg-black/20 dark:hover:!bg-white/25",
            // Accessible focus ring
            "focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-current/40 focus-visible:!ring-offset-0",
            "!transition-colors !duration-150",
          ].join(" "),
        },
      }}
    />
  );
}

/**
 * Wrapped `toast` namespace that enforces a uniform 3s duration for all
 * variants (error, success, info, warning). Per-call `duration` overrides
 * still win.
 */
export const toast: typeof sonnerToast = Object.assign(
  (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
  {
    ...sonnerToast,
    error: (...args: Parameters<typeof sonnerToast.error>) =>
      sonnerToast.error(args[0], { duration: 3000, ...args[1] }),
    success: (...args: Parameters<typeof sonnerToast.success>) =>
      sonnerToast.success(args[0], { duration: 3000, ...args[1] }),
    info: (...args: Parameters<typeof sonnerToast.info>) =>
      sonnerToast.info(args[0], { duration: 3000, ...args[1] }),
    warning: (...args: Parameters<typeof sonnerToast.warning>) =>
      sonnerToast.warning(args[0], { duration: 3000, ...args[1] }),
  }
);
