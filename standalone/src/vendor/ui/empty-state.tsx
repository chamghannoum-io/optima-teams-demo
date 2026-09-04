import type { ReactNode } from "react";
import { cn } from "./utils.js";

/**
 * EmptyState — Cortex Design System (SKILL 5.23)
 *
 * py-12 px-6, icon text-slate-200 dark:text-[#2A3141],
 * title text-sm font-bold text-slate-400,
 * description text-[11px] text-slate-400 max-w-sm
 */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}
    >
      {icon && <div className="mb-4 text-slate-200 dark:text-[#2A3141]">{icon}</div>}
      <h3 className="text-sm font-bold text-slate-400 dark:text-[#64748B]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[11px] text-slate-400 dark:text-[#64748B]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
