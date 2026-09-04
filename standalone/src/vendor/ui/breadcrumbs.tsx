import type { ReactNode } from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "./utils.js";

/**
 * Breadcrumbs — Cortex Design System (SKILL 5.48)
 *
 * Variants: default, pill, compact
 * Separators: chevron (default), slash, dot
 */

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Click handler — omit for non-clickable items */
  onClick?: () => void;
  /** Optional leading icon */
  icon?: ReactNode;
  /** Marks this as the current/active page (last item) */
  isCurrent?: boolean;
}

export type BreadcrumbVariant = "default" | "pill" | "compact";
export type BreadcrumbSeparator = "chevron" | "slash" | "dot";

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  variant?: BreadcrumbVariant;
  separator?: BreadcrumbSeparator;
  showHomeIcon?: boolean;
  maxItems?: number;
  className?: string;
}

const SEPARATORS: Record<BreadcrumbSeparator, ReactNode> = {
  chevron: <ChevronRight size={12} className="text-slate-300 dark:text-[#2A3141] shrink-0" />,
  slash: <span className="text-slate-300 dark:text-[#2A3141] text-xs shrink-0">/</span>,
  dot: <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#2A3141] shrink-0" />,
};

export function Breadcrumbs({
  items,
  variant = "default",
  separator = "chevron",
  showHomeIcon = false,
  maxItems,
  className,
}: BreadcrumbsProps) {
  // Collapse middle items if maxItems is set
  let displayItems = items;
  if (maxItems && items.length > maxItems && maxItems >= 3) {
    const head = items.slice(0, 1);
    const tail = items.slice(-(maxItems - 2));
    displayItems = [...head, { label: "…", isCurrent: false }, ...tail];
  }

  const sep = SEPARATORS[separator];

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className={cn("flex items-center", variant === "pill" ? "gap-1" : "gap-1.5")}>
        {displayItems.map((item, i) => {
          const isFirst = i === 0;
          const isLast = i === displayItems.length - 1;
          const isCurrent = item.isCurrent ?? isLast;
          const isClickable = !!item.onClick && !isCurrent && item.label !== "…";
          const Icon = isFirst && showHomeIcon ? Home : null;
          const CustomIcon = item.icon;

          return (
            <li key={i} className="flex items-center gap-1.5">
              {/* Separator */}
              {i > 0 && (
                <span className="flex items-center" aria-hidden="true">
                  {sep}
                </span>
              )}

              {/* Item */}
              {variant === "pill" ? (
                <button
                  onClick={isClickable ? item.onClick : undefined}
                  disabled={!isClickable}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-[#2D3670]/5 dark:bg-[#2D3670]/10 text-[#2D3670] dark:text-[#a5b1db] font-semibold"
                      : isClickable
                        ? "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1C2535] hover:text-slate-700 dark:hover:text-slate-300"
                        : "text-slate-400 dark:text-[#64748B]"
                  )}
                >
                  {Icon && <Icon size={13} className="shrink-0" />}
                  {CustomIcon}
                  <span>{item.label}</span>
                </button>
              ) : variant === "compact" ? (
                <button
                  onClick={isClickable ? item.onClick : undefined}
                  disabled={!isClickable}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] transition-colors",
                    isCurrent
                      ? "text-slate-900 dark:text-[#E2E8F0] font-bold"
                      : isClickable
                        ? "text-slate-400 dark:text-[#64748B] hover:text-[#2D3670] dark:hover:text-[#a5b1db]"
                        : "text-slate-400 dark:text-[#64748B]"
                  )}
                >
                  {Icon && <Icon size={11} className="shrink-0" />}
                  {CustomIcon}
                  <span>{item.label}</span>
                </button>
              ) : (
                /* Default variant */
                <button
                  onClick={isClickable ? item.onClick : undefined}
                  disabled={!isClickable}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm transition-colors",
                    isCurrent
                      ? "text-slate-900 dark:text-[#E2E8F0] font-medium"
                      : isClickable
                        ? "text-slate-500 dark:text-[#94A3B8] hover:text-[#2D3670] dark:hover:text-[#a5b1db]"
                        : "text-slate-500 dark:text-[#94A3B8]"
                  )}
                >
                  {Icon && <Icon size={14} className="shrink-0" />}
                  {CustomIcon}
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
