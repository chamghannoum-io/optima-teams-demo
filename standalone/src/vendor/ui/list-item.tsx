import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "./utils.js";

/**
 * ListItem — Cortex Design System (SKILL 5.39)
 *
 * Container: w-full px-5 py-4 text-left border-b transition-colors relative
 * Hover:     hover:bg-slate-50 dark:hover:bg-dark-hover (when not disabled)
 * Selected:  bg-primary/5 dark:bg-primary/10 + ActiveIndicator
 * Title:     text-sm font-bold text-slate-900 dark:text-dark-text truncate
 * Subtitle:  text-[10px] text-slate-500 dark:text-slate-400
 * Trailing:  ReactNode (top-right, e.g. status badge)
 * Tag:       ReactNode (bottom-right)
 */

export interface ListItemProps {
  /** Whether this item is the selected / active item */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Primary text (top-left) */
  title: string;
  /** Secondary text (bottom-left) */
  subtitle?: string;
  /** ReactNode shown on the top-right (e.g. StatusBadge) */
  trailing?: ReactNode;
  /** ReactNode shown on the bottom-right (e.g. tag pill) */
  tag?: ReactNode;
  /** Active indicator position */
  indicatorPosition?: "left" | "right";
  /** Disable hover/active styling */
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  "data-testid"?: string;
}

export function ListItem({
  isSelected = false,
  onClick,
  title,
  subtitle,
  trailing,
  tag,
  indicatorPosition = "right",
  disabled = false,
  className,
  children,
  "data-testid": dataTestId,
}: ListItemProps) {
  const indicatorClass =
    indicatorPosition === "right"
      ? "right-0 top-0 bottom-0 w-1 rounded-l"
      : "left-0 top-0 bottom-0 w-1 rounded-r";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
      className={cn(
        "w-full px-5 py-4 text-left border-b transition-colors relative",
        "border-slate-50 dark:border-[#2A3141]/50",
        !disabled && "hover:bg-slate-50 dark:hover:bg-[#1C2535]",
        isSelected && "bg-[#2D3670]/5 dark:bg-[#2D3670]/10",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Active indicator bar */}
      {isSelected && (
        <motion.div
          layoutId="list-item-active"
          className={cn("absolute bg-[#2D3670] dark:bg-[#a5b1db]", indicatorClass)}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      {/* Top row: title + trailing */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-slate-900 dark:text-[#E2E8F0] truncate">
          {title}
        </span>
        {trailing}
      </div>

      {/* Bottom row: subtitle + tag */}
      {(subtitle || tag) && (
        <div className="flex items-center justify-between">
          {subtitle && (
            <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">{subtitle}</span>
          )}
          {tag}
        </div>
      )}

      {/* Escape hatch: render custom children below the standard rows */}
      {children}
    </button>
  );
}
