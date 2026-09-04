import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "./utils.js";

/**
 * SectionHeader — Cortex Design System (SKILL 5.45)
 *
 * Unified heading for page sections with 5 size presets.
 *
 * Sizes:  xs (text-[10px]) | sm (text-xs) | md (text-sm) | lg (text-base) | xl (text-lg)
 * Colors: default | primary | muted
 * Micro:  text-[10px] font-bold uppercase tracking-wider (label style)
 */

type SectionHeaderSize = "xs" | "sm" | "md" | "lg" | "xl";
type SectionHeaderColor = "default" | "primary" | "muted";

interface SectionHeaderProps {
  /** Heading text */
  title: string;
  /** Optional description below the title */
  subtitle?: string;
  /** Size preset */
  size?: SectionHeaderSize;
  /** Optional leading icon */
  icon?: ReactNode;
  /** Right-side action slot */
  action?: ReactNode;
  /** Render as uppercase micro-label style */
  micro?: boolean;
  /** Custom colour for the title */
  color?: SectionHeaderColor;
  className?: string;
}

const SIZE_CLASSES: Record<SectionHeaderSize, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

const COLOR_CLASSES: Record<SectionHeaderColor, string> = {
  default: "text-slate-900 dark:text-[#E2E8F0]",
  primary: "text-[#2D3670] dark:text-[#a5b1db]",
  muted: "text-slate-400 dark:text-[#64748B]",
};

export function SectionHeader({
  title,
  subtitle,
  size = "md",
  icon,
  action,
  micro = false,
  color = "default",
  className,
}: SectionHeaderProps) {
  if (micro) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn("flex items-center justify-between", className)}
      >
        <span className="text-[10px] font-bold text-[#2D3670] dark:text-[#a5b1db] uppercase tracking-wider">
          {title}
        </span>
        {action}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex items-center justify-between", className)}
    >
      <div className="flex items-center gap-2">
        {icon && <span className={COLOR_CLASSES[color]}>{icon}</span>}
        <div>
          <span className={cn("font-bold", SIZE_CLASSES[size], COLOR_CLASSES[color])}>{title}</span>
          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-[#64748B] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </motion.div>
  );
}
