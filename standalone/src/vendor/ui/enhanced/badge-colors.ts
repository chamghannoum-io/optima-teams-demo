import type { ReactNode } from "react";

// ─── Color Presets ───────────────────────────────────────────────────

export const BADGE_COLORS = {
  success: {
    bg: "bg-[var(--badge-success-bg)] dark:bg-[var(--badge-success-bg-dark)]",
    text: "text-[var(--badge-success-text)] dark:text-[var(--badge-success-text-dark)]",
    dot: "bg-[var(--badge-success-dot)]",
    border: "border-[var(--badge-success-border)] dark:border-[var(--badge-success-border-dark)]",
    ring: "focus-visible:ring-[var(--badge-success-dot)]/30",
  },
  danger: {
    bg: "bg-[var(--badge-danger-bg)] dark:bg-[var(--badge-danger-bg-dark)]",
    text: "text-[var(--badge-danger-text)] dark:text-[var(--badge-danger-text-dark)]",
    dot: "bg-[var(--badge-danger-dot)]",
    border: "border-[var(--badge-danger-border)] dark:border-[var(--badge-danger-border-dark)]",
    ring: "focus-visible:ring-[var(--badge-danger-dot)]/30",
  },
  warning: {
    bg: "bg-[var(--badge-warning-bg)] dark:bg-[var(--badge-warning-bg-dark)]",
    text: "text-[var(--badge-warning-text)] dark:text-[var(--badge-warning-text-dark)]",
    dot: "bg-[var(--badge-warning-dot)]",
    border: "border-[var(--badge-warning-border)] dark:border-[var(--badge-warning-border-dark)]",
    ring: "focus-visible:ring-[var(--badge-warning-dot)]/30",
  },
  info: {
    bg: "bg-[var(--badge-info-bg)] dark:bg-[var(--badge-info-bg-dark)]",
    text: "text-[var(--badge-info-text)] dark:text-[var(--badge-info-text-dark)]",
    dot: "bg-[var(--badge-info-dot)]",
    border: "border-[var(--badge-info-border)] dark:border-[var(--badge-info-border-dark)]",
    ring: "focus-visible:ring-[var(--badge-info-dot)]/30",
  },
  orange: {
    bg: "bg-[var(--badge-orange-bg)] dark:bg-[var(--badge-orange-bg-dark)]",
    text: "text-[var(--badge-orange-text)] dark:text-[var(--badge-orange-text-dark)]",
    dot: "bg-[var(--badge-orange-dot)]",
    border: "border-[var(--badge-orange-border)] dark:border-[var(--badge-orange-border-dark)]",
    ring: "focus-visible:ring-[var(--badge-orange-dot)]/30",
  },
  neutral: {
    bg: "bg-[var(--badge-neutral-bg)] dark:bg-[var(--badge-neutral-bg-dark)]",
    text: "text-[var(--badge-neutral-text)] dark:text-[var(--badge-neutral-text-dark)]",
    dot: "bg-[var(--badge-neutral-dot)]",
    border: "border-[var(--badge-neutral-border)] dark:border-[var(--badge-neutral-border-dark)]",
    ring: "focus-visible:ring-[var(--badge-neutral-dot)]/30",
  },
} as const;

export type BadgeColor = keyof typeof BADGE_COLORS;

// ─── Shared Size System ──────────────────────────────────────────────

export const BADGE_SIZES = {
  xs: {
    fontSize: "text-[11px]",
    px: "px-1.5",
    py: "py-[3px]",
    gap: "gap-1",
    iconSize: "w-3 h-3",
    dotSize: "xs" as const,
    removeSize: "w-2.5 h-2.5",
  },
  sm: {
    fontSize: "text-xs",
    px: "px-2",
    py: "py-[3px]",
    gap: "gap-1.5",
    iconSize: "w-3.5 h-3.5",
    dotSize: "sm" as const,
    removeSize: "w-3 h-3",
  },
  md: {
    fontSize: "text-xs",
    px: "px-2.5",
    py: "py-1",
    gap: "gap-1.5",
    iconSize: "w-3.5 h-3.5",
    dotSize: "sm" as const,
    removeSize: "w-3 h-3",
  },
  lg: {
    fontSize: "text-sm",
    px: "px-3",
    py: "py-1.5",
    gap: "gap-2",
    iconSize: "w-4 h-4",
    dotSize: "md" as const,
    removeSize: "w-3.5 h-3.5",
  },
} as const;

export type BadgeSize = keyof typeof BADGE_SIZES;

// ─── Dot Sizes ───────────────────────────────────────────────────────

export const DOT_SIZES = {
  xs: "w-1 h-1",
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
} as const;

export type DotSize = keyof typeof DOT_SIZES;

// ─── Status → Color Mapping ─────────────────────────────────────────

export const STATUS_TO_COLOR: Record<string, BadgeColor> = {
  Compliant: "success",
  Active: "success",
  Approved: "success",
  Passed: "success",
  Complete: "success",
  Completed: "success",
  Eligible: "success",
  Covered: "success",
  Paid: "success",
  Accepted: "success",
  Verified: "success",
  Resolved: "success",
  Online: "success",
  PASS: "success",
  Pass: "success",
  Success: "success",

  "Non Compliant": "danger",
  Failed: "danger",
  Rejected: "danger",
  Fail: "danger",
  Critical: "danger",
  Error: "danger",
  Denied: "danger",
  Cancelled: "danger",
  Expired: "danger",
  "Not Eligible": "danger",
  Overdue: "danger",
  FAIL: "danger",
  Blocked: "danger",

  "Require Review": "warning",
  Pending: "warning",
  Warning: "warning",
  "In Progress": "warning",
  Medium: "warning",
  "Under Review": "warning",
  "On Hold": "warning",
  Partial: "warning",
  Queued: "warning",
  Processing: "warning",
  Suspended: "warning",
  Maternity: "warning",

  High: "danger",
  Elevated: "danger",
  Urgent: "danger",
  Priority: "danger",

  Low: "neutral",
  Info: "neutral",
  Draft: "neutral",
  New: "neutral",
  Scheduled: "neutral",
  Routine: "neutral",
  Open: "neutral",
  Package: "neutral",
  Primary: "neutral",
  "In Review": "neutral",

  "Not Evaluated": "neutral",
  "Not Tested": "neutral",
  "N/A": "neutral",
  Unknown: "neutral",
  Inactive: "neutral",
  Archived: "neutral",
  Closed: "neutral",
  Secondary: "neutral",

  // ─── Uppercase variants (GraphQL enums) ────────────────────────────
  APPROVED: "success",
  VALIDATED: "success",
  ACCEPTED: "success",
  COMPLETED: "success",
  ACTIVE: "success",
  ELIGIBLE: "success",
  COVERED: "success",
  PAID: "success",
  RESOLVED: "success",
  VERIFIED: "success",

  REJECTED: "danger",
  DENIED: "danger",
  FAILED: "danger",
  CANCELLED: "danger",
  EXPIRED: "danger",
  NOT_ELIGIBLE: "danger",
  BLOCKED: "danger",
  NOT_VALIDATED: "danger",

  PENDING: "warning",
  IN_PROGRESS: "warning",
  UNDER_REVIEW: "warning",
  PROCESSING: "warning",
  QUEUED: "warning",
  ON_HOLD: "warning",
  PARTIALLY_APPROVED: "warning",
  PARTIAL: "warning",
  SUSPENDED: "warning",

  DRAFT: "neutral",
  NEW: "neutral",
  SCHEDULED: "neutral",
  OPEN: "neutral",
  IN_REVIEW: "neutral",
};

export function resolveColor(color: BadgeColor | "auto", children: ReactNode): BadgeColor {
  if (color !== "auto") return color;
  const key = typeof children === "string" ? children : "";
  return STATUS_TO_COLOR[key] ?? "neutral";
}

// ─── Shared base classes ─────────────────────────────────────────────

export const BASE_CLASSES =
  "inline-flex items-center font-semibold leading-none whitespace-nowrap transition-all duration-150";

export const INTERACTIVE_CLASSES =
  "cursor-pointer hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
