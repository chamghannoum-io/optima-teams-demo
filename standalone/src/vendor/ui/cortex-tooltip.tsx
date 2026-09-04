import React, { useState, useRef, useCallback, useId, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./utils.js";

interface TooltipProps {
  /**
   * Bubble content. A string for the usual one-liner; a node when the tooltip
   * has to explain something structured (pair it with `align="start"`, since
   * centred body text is hard to read).
   */
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** Text alignment inside the bubble. Defaults to centred. */
  align?: "center" | "start";
  className?: string;
}

type Side = "top" | "bottom" | "left" | "right";

const VIEWPORT_PADDING = 8;

const CortexTooltip: React.FC<TooltipProps> = ({
  label,
  children,
  side = "top",
  align = "center",
  className,
}) => {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [resolved, setResolved] = useState<{
    side: Side;
    left: number;
    top: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    if (!wrapRef.current) return;
    setAnchor(wrapRef.current.getBoundingClientRect());
  }, []);

  const hide = useCallback(() => {
    setAnchor(null);
    setResolved(null);
  }, []);

  useLayoutEffect(() => {
    if (!anchor || !tooltipRef.current) return;
    const t = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fits = (s: Side) => {
      if (s === "left") return anchor.left - 8 - t.width >= VIEWPORT_PADDING;
      if (s === "right") return anchor.right + 8 + t.width <= vw - VIEWPORT_PADDING;
      if (s === "top") return anchor.top - 8 - t.height >= VIEWPORT_PADDING;
      return anchor.bottom + 8 + t.height <= vh - VIEWPORT_PADDING;
    };

    const flipMap: Record<Side, Side> = {
      left: "right",
      right: "left",
      top: "bottom",
      bottom: "top",
    };
    const finalSide: Side = fits(side) ? side : fits(flipMap[side]) ? flipMap[side] : side;

    const centerX = anchor.left + anchor.width / 2 - t.width / 2;
    const centerY = anchor.top + anchor.height / 2 - t.height / 2;
    const rawLeft =
      finalSide === "left"
        ? anchor.left - 8 - t.width
        : finalSide === "right"
          ? anchor.right + 8
          : centerX;
    const rawTop =
      finalSide === "top"
        ? anchor.top - 8 - t.height
        : finalSide === "bottom"
          ? anchor.bottom + 8
          : centerY;

    const left = Math.max(VIEWPORT_PADDING, Math.min(rawLeft, vw - t.width - VIEWPORT_PADDING));
    const top = Math.max(VIEWPORT_PADDING, Math.min(rawTop, vh - t.height - VIEWPORT_PADDING));

    setResolved({ side: finalSide, left, top });
  }, [anchor, side]);

  const child = React.Children.only(children) as React.ReactElement;
  const enhancedChild = React.cloneElement(child, {
    "aria-describedby": anchor ? tooltipId : undefined,
  } as React.HTMLAttributes<HTMLElement>);

  const getInitial = () => {
    const s = resolved?.side ?? side;
    if (s === "left") return { opacity: 0, x: 4, scale: 0.92 };
    if (s === "right") return { opacity: 0, x: -4, scale: 0.92 };
    return { opacity: 0, y: s === "top" ? 4 : -4, scale: 0.92 };
  };

  return (
    <div
      ref={wrapRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {enhancedChild}
      {createPortal(
        <AnimatePresence>
          {anchor && (
            <motion.div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              initial={getInitial()}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={getInitial()}
              transition={{ duration: 0.1, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: resolved?.left ?? -9999,
                top: resolved?.top ?? -9999,
                visibility: resolved ? "visible" : "hidden",
                zIndex: 99999,
                // Cap at a readable line length AND the viewport — long labels
                // wrap inside the bubble instead of running past the screen edge
                // (the position is clamped, but nowrap text overflowed the cap).
                maxWidth: `min(320px, calc(100vw - ${VIEWPORT_PADDING * 2}px))`,
              }}
              className={cn(
                "pointer-events-none px-2 py-1 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-semibold whitespace-normal break-words shadow-lg",
                align === "start" ? "text-left" : "text-center"
              )}
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export { CortexTooltip };
