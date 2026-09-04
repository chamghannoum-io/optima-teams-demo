/** Stands in for @optima/shared. Real implementations where they matter. */
import type { ReactNode } from "react";

/** Real shape from packages/shared, used by AppShell. */
export interface NavItem {
  to: string;
  label: string;
  icon?: ReactNode;
  children?: NavItem[];
}

export interface IBaseOption<T = unknown> {
  key: string;
  label: string;
  value: T;
}

export function isBaseOption(v: unknown): v is IBaseOption<unknown> {
  return typeof v === "object" && v !== null && "key" in v && "label" in v && "value" in v;
}

export function isRTL(): boolean {
  return false;
}
export function getDirection(): "ltr" | "rtl" {
  return "ltr";
}

/** The real hook returns the translate function itself, not an object. */
export function useI18n() {
  return (key: string, opts?: any): string => {
    if (opts?.defaultValue) return String(opts.defaultValue);
    const leaf = String(key).split(".").pop() ?? String(key);
    const words = leaf.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    const text = words.charAt(0).toUpperCase() + words.slice(1);
    return opts && typeof opts === "object"
      ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ""))
      : text;
  };
}

export function isApolloGraphqlErrorAlreadyToastedGlobally(_e: unknown): boolean {
  return false;
}
export function logApiError(scope: string, e: unknown): void {
  console.error("[" + scope + "]", e);
}
