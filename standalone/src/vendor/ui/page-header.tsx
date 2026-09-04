import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "./utils.js";

/**
 * PageHeader — Cortex Design System (SKILL 5.44)
 *
 * Sits flush above Tabs when both are present (no double border).
 * Container uses same surface as TabsList (bg-white / dark:bg-dark-surface).
 * Border-b only appears when there's no children/Tabs below.
 *
 * Title:     text-sm font-bold tracking-tight
 * Subtitle:  text-[9px] font-bold uppercase tracking-widest
 */

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  statusBadge?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  statusBadge,
  icon,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#111827] shrink-0",
        "border-b border-slate-200 dark:border-[#2A3141]",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-1.5 bg-white dark:bg-[#151C28] rounded-lg border border-slate-200 dark:border-[#2A3141] text-slate-600 dark:text-[#94A3B8]">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-[#E2E8F0] tracking-tight">
                {title}
              </h1>
              {statusBadge}
            </div>
            {subtitle && (
              <div className="text-[9px] font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-widest mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" }}
            className="flex items-center gap-3"
          >
            {actions}
          </motion.div>
        )}
      </motion.div>
      {children && <div className="px-6 pb-3">{children}</div>}
    </div>
  );
}
