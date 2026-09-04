import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "./utils.js";

/**
 * Sheet — Cortex Design System (SKILL 5.6 Modal, slide-right variant)
 *
 * Backdrop: bg-black/30 z-[80] (no backdrop-blur: Chromium mis-composites layers
 * above a backdrop-filter while their content repaints during scroll, making
 * the sheet flash transparent)
 *
 * Layer: z-[80] — the same layer as {@link Dialog}, since both wrap Radix
 * Dialog and are the topmost overlay a user opens. This must stay above the
 * z-[70] Modal layer so a sheet opened from inside a Modal (e.g. "Add
 * Department" from the Departments drawer) renders on top of it instead of
 * behind it. (OPTIMA-3483)
 * Content: bg-white dark:bg-[#111827], shadow-2xl, border-l
 * Header: px-8 py-5 border-b
 */

export const Sheet = DialogPrimitive.Root;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[80] bg-black/30",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

type SheetSide = "top" | "right" | "bottom" | "left";

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: SheetSide;
  closeButtonTestId?: string;
}

const sideStyles: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom:
    "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  left: "inset-y-0 start-0 h-full w-3/4 border-e data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-4xl",
  right:
    "inset-y-0 end-0 h-full w-3/4 border-s data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
};

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = "right",
      className,
      children,
      closeButtonTestId,
      onPointerDownOutside,
      onFocusOutside,
      ...props
    },
    ref
  ) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-[80] gap-4 p-6 shadow-2xl transition ease-in-out",
          "bg-white dark:bg-[#111827]",
          "border-slate-300 dark:border-[#2A3141] ring-1 ring-black/5 dark:ring-white/5",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          sideStyles[side],
          className
        )}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target?.closest("[data-radix-popper-content-wrapper]") ||
            target?.closest("[role='dialog']")
          ) {
            e.preventDefault();
          }
          onPointerDownOutside?.(e);
        }}
        onFocusOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (
            target?.closest("[data-radix-popper-content-wrapper]") ||
            target?.closest("[role='dialog']")
          ) {
            e.preventDefault();
          }
          onFocusOutside?.(e);
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-testid={closeButtonTestId}
          className="absolute end-4 top-4 z-20 rounded-lg p-1.5 text-slate-400 dark:text-[#64748B] transition-colors hover:bg-slate-50 dark:hover:bg-[#1C2535] hover:text-slate-600 dark:hover:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2D3670]/20 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#111827] disabled:pointer-events-none"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 px-8 py-5 border-b border-slate-200 dark:border-[#2A3141] text-center sm:text-start",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

export const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-8 py-5 border-t border-slate-200 dark:border-[#2A3141]",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-bold text-slate-900 dark:text-[#E2E8F0]", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-slate-500 dark:text-[#94A3B8]", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;
