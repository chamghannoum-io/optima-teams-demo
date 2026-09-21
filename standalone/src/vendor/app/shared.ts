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

// ── Relay + option helpers, ported from @optima/shared/autocomplete ──────

export type IFieldSelector<T> = Extract<keyof T, string> | ((item: T) => string | null | undefined);

const pick = <T,>(item: T, sel: IFieldSelector<T>): string =>
  typeof sel === "function" ? String(sel(item) ?? "") : String((item as any)?.[sel] ?? "");

export function createBaseOption<T>(
  item: T,
  keyBy: IFieldSelector<T>,
  labelBy: IFieldSelector<T>,
): IBaseOption<T> {
  return { key: pick(item, keyBy), label: pick(item, labelBy), value: item };
}

export function mapToBaseOptions<T>(
  items: T[],
  keyBy: IFieldSelector<T>,
  labelBy: IFieldSelector<T>,
): IBaseOption<T>[] {
  return (items ?? []).map((i) => createBaseOption(i, keyBy, labelBy));
}

export const extractNodes = (conn: { edges?: Array<{ node?: unknown } | null> | null } | null) =>
  (conn?.edges ?? []).map((e) => e?.node).filter(Boolean) as unknown[];

export const extractPageInfo = (
  conn: { pageInfo?: { hasNextPage: boolean; endCursor?: string | null } | null } | null,
) => conn?.pageInfo ?? { hasNextPage: false, endCursor: null };

/** Config shape ApiAutocomplete consumes. Mirrors AutocompleteApiConfig. */
export interface AutocompleteApiConfig {
  useQuery: (opts: any) => { data: any; loading: boolean; fetchMore?: any };
  keyBy: IFieldSelector<any>;
  labelBy: IFieldSelector<any>;
  searchKey?: string;
  isPaginated?: boolean;
}

/** Mirrors createAutocompleteQueryConfig: config plus the option mappers. */
export function createAutocompleteQueryConfig(props: AutocompleteApiConfig) {
  const { useQuery, keyBy, labelBy, searchKey, isPaginated = true } = props;
  const queryConfig: AutocompleteApiConfig = { useQuery, keyBy, labelBy, searchKey, isPaginated };
  return {
    queryConfig,
    toOption: (item: any) => createBaseOption(item, keyBy, labelBy),
    toOptions: (items: any[]) => mapToBaseOptions(items, keyBy, labelBy),
    isPaginated,
  };
}
