import React, { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../utils.js";
import { motion, AnimatePresence } from "motion/react";

type ModalVariant = "center" | "slide-right" | "slide-left";
type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  titleClassName?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Optional action buttons rendered inline with the title row, left of the Close (X) button. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: ModalVariant;
  size?: ModalSize;
  className?: string;
  overlayClassName?: string;
  contentWrapperClassName?: string;
  contentBodyClassName?: string;
  style?: React.CSSProperties;
  testId?: string;
  closeButtonTestId?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Ordered stack of currently-open modal ids (bottom → top). When modals are
// stacked (e.g. an activity-edit modal opened on top of the claim drawer,
// which is itself a slide-right Modal), Escape and focus-trapping must only
// act on the topmost layer — otherwise a single Escape closes every open
// modal at once.
const modalStack: string[] = [];

// Close handlers for every currently-open modal, keyed by modal id. Lets
// callers dismiss all open modals at once (e.g. the floating support widget
// needs to clear an open claim/pre-auth drawer before showing the assistant).
// A Map preserves insertion order, so iterating it reflects open order
// (bottom → top). Modals that live outside this package (e.g. the provider
// app's own Modal in @/components/enhanced) register here too via
// `registerModalCloseHandler`, so a single `closeAllModals()` reaches every
// open drawer regardless of which Modal implementation rendered it.
const modalCloseHandlers = new Map<string, () => void>();

// Subscribers notified whenever the open-modal set changes (a modal registers
// or unregisters). Lets `closeAllModals` observe whether the screen actually
// cleared after firing every close handler — some handlers resolve
// asynchronously (e.g. an unsaved-changes guard that waits for the user to
// confirm) rather than closing synchronously.
const modalChangeSubscribers = new Set<() => void>();

/** Notify subscribers that the open-modal set changed. */
function notifyModalChange(): void {
  for (const fn of [...modalChangeSubscribers]) fn();
}

/** Subscribe to open-modal-set changes. Returns an unsubscribe function. */
function subscribeModalChange(fn: () => void): () => void {
  modalChangeSubscribers.add(fn);
  return () => {
    modalChangeSubscribers.delete(fn);
  };
}

/**
 * Register a close handler for an open modal so `closeAllModals` can dismiss
 * it. Returns an unregister function to call when the modal closes/unmounts.
 * Use this from Modal implementations that do not extend this package's Modal
 * but still need to participate in global "close everything" behaviour.
 */
export function registerModalCloseHandler(id: string, close: () => void): () => void {
  modalCloseHandlers.set(id, close);
  notifyModalChange();
  return () => {
    modalCloseHandlers.delete(id);
    notifyModalChange();
  };
}

/**
 * Close every currently-open Modal (all stacked layers, topmost first) and
 * resolve once the screen has settled.
 *
 * Resolves `true` when every modal open at call time has actually closed — the
 * caller can safely take over the screen. Resolves `false` when a modal refused
 * to close (e.g. an unsaved-changes guard where the user chose "Continue
 * Editing"), so the caller can abort its take-over instead of stranding its UI
 * behind a still-open drawer. Callers that only need to dismiss drawers can
 * ignore the returned promise.
 */
export function closeAllModals(): Promise<boolean> {
  // Snapshot the open modals — the "target set" we're asking to close — then
  // fire each handler top → bottom so closing an inner layer can't skip an
  // outer one.
  const target = new Set(modalCloseHandlers.keys());
  for (const id of [...target].reverse()) {
    modalCloseHandlers.get(id)?.();
  }

  // Nothing was open → the screen is already clear.
  if (target.size === 0) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let scheduled = false;
    let unsubscribe = () => {};

    const evaluate = () => {
      scheduled = false;
      const targetStillOpen = [...target].some((id) => modalCloseHandlers.has(id));
      if (!targetStillOpen) {
        // Every modal we asked to close is gone → the screen is clear.
        unsubscribe();
        resolve(true);
        return;
      }
      const childOpen = [...modalCloseHandlers.keys()].some((id) => !target.has(id));
      if (!childOpen) {
        // A target modal is still open and no child prompt is up → the user
        // kept it open (e.g. "Continue Editing" on an unsaved-changes guard).
        unsubscribe();
        resolve(false);
      }
      // Otherwise a child prompt (e.g. a "Save as Draft?" confirmation) is
      // still open — keep waiting for the user to resolve it.
    };

    const onChange = () => {
      // Coalesce the set/delete churn of a single React commit into one
      // evaluation so we never act on an intermediate state (e.g. a guard
      // unmounting in the same commit its parent drawer does).
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(evaluate);
    };

    unsubscribe = subscribeModalChange(onChange);
  });
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  titleClassName,
  subtitle,
  icon,
  headerActions,
  children,
  footer,
  variant = "center",
  size = "md",
  className,
  overlayClassName,
  contentWrapperClassName,
  contentBodyClassName,
  style,
  testId,
  closeButtonTestId,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const modalId = useId();
  const onCloseRef = useRef(onClose);
  // eslint-disable-next-line react-hooks/refs
  onCloseRef.current = onClose;
  const pointerDownOnOverlayRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    modalStack.push(modalId);
    modalCloseHandlers.set(modalId, () => onCloseRef.current());
    notifyModalChange();
    const prevFocus = document.activeElement as HTMLElement;
    const focusTimer = setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 50);
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the topmost open modal reacts to Escape / Tab. Without this gate
      // every stacked Modal's document listener fires on one Escape, closing
      // them all (e.g. the activity-edit modal AND the claim drawer beneath).
      if (modalStack[modalStack.length - 1] !== modalId) return;
      if (e.key === "Escape") {
        // Stop the event so no other modal/dialog listener (or an underlying
        // Radix layer) also closes on the same Escape.
        e.stopImmediatePropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      const idx = modalStack.lastIndexOf(modalId);
      if (idx !== -1) modalStack.splice(idx, 1);
      modalCloseHandlers.delete(modalId);
      notifyModalChange();
      prevFocus?.focus();
    };
  }, [isOpen, modalId]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const overlay = overlayRef.current;
      if (!overlay || !(e.target instanceof Node)) return;
      pointerDownOnOverlayRef.current = overlay.contains(e.target);
    };
    const onPointerUp = (e: PointerEvent) => {
      const overlay = overlayRef.current;
      if (!overlay || !(e.target instanceof Node)) return;
      const upInsideOverlay = overlay.contains(e.target);
      if (pointerDownOnOverlayRef.current && upInsideOverlay) {
        onCloseRef.current();
      }
      pointerDownOnOverlayRef.current = false;
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [isOpen]);

  const headerBlock = (title || icon) && (
    <div className="flex items-center justify-between gap-6 px-8 py-5 border-b border-slate-100 dark:border-dark-border/50 shrink-0">
      {/* flex-1 + min-w-0 makes this side the one that gives way: without a
          definite basis it sizes to its content and the actions get pushed. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <span aria-hidden="true" className="shrink-0">
            {icon}
          </span>
        )}
        {/* Titles truncate rather than wrap: subtitles are usually one
            unbreakable id (a transaction number), which would otherwise
            overflow the shrunk box and run underneath the header actions. The
            full value stays available through the native tooltip. */}
        <div className="min-w-0 flex-1">
          {title && (
            <h2
              id={titleId}
              title={title}
              className={cn(
                "truncate text-base font-bold text-slate-900 dark:text-dark-text",
                titleClassName
              )}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              title={subtitle}
              className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500"
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {headerActions}
        {headerActions && (
          <span aria-hidden="true" className="h-6 w-px bg-slate-200 dark:bg-dark-border/70 mx-1" />
        )}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          data-testid={closeButtonTestId}
          className="p-2 hover:bg-slate-100 dark:hover:bg-dark-hover rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );

  const footerBlock = footer && (
    <div className="px-8 py-5 border-t border-slate-100 dark:border-dark-border/50 flex items-center gap-3 shrink-0">
      {footer}
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* No backdrop-blur on the scrim: Chromium mis-composites layers above a
              backdrop-filter while their content repaints (scrolling inside the
              panel), making the panel flash transparent. See styles.css
              "Embedded-shell rendering fix" for the same bug in WebViews. */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("fixed inset-0 bg-black/30 z-[70]", overlayClassName)}
            aria-hidden="true"
          />
          {variant === "center" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none",
                contentWrapperClassName
              )}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                data-testid={testId}
                className={cn(
                  "bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full pointer-events-auto border border-slate-200 dark:border-dark-border overflow-hidden flex flex-col max-h-[90vh]",
                  SIZE_MAP[size],
                  className
                )}
              >
                {headerBlock}
                <div className={cn("flex-1 overflow-y-auto", contentBodyClassName)}>{children}</div>
                {footerBlock}
              </div>
            </motion.div>
          ) : (
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              data-testid={testId}
              initial={{ opacity: 0, x: variant === "slide-left" ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: variant === "slide-left" ? -40 : 40 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={style}
              className={cn(
                "fixed top-0 bottom-0 bg-white dark:bg-dark-surface shadow-2xl z-[70] flex flex-col overflow-hidden",
                variant === "slide-left"
                  ? "left-0 border-r border-slate-200 dark:border-dark-border"
                  : "right-0 border-l border-slate-200 dark:border-dark-border",
                className,
                contentWrapperClassName
              )}
            >
              {headerBlock}
              <div className={cn("flex-1 overflow-y-auto", contentBodyClassName)}>{children}</div>
              {footerBlock}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export { Modal };
export type { ModalVariant, ModalSize };
