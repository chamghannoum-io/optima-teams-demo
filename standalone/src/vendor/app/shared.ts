/** Stands in for @optima/shared. Real implementations where they matter. */
import type { ReactNode } from "react";
import { translate } from "./i18n.js";

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
/**
 * Same dictionary the react-i18next stub uses.
 *
 * This used to go straight to the last-segment fallback, so every key it was
 * given rendered as its own leaf: `filters.button` came out as the word
 * "Button" on the filter control next to Add Team. Sharing one translate means
 * a label added for one caller shows up for both.
 */
export function useI18n() {
  return translate;
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

/* ── the two context hooks the ported rcm-dashboard reads ──────────────────
 * Upstream these come from packages/shared/src/site-settings.tsx and
 * apps/provider/src/app/working-branch-context.tsx, both fed by providers at
 * the app root. The shapes are copied from those files; there is one tenant
 * and one working branch locally, so the values are fixed rather than wired to
 * a provider the standalone shell does not have.
 */

export interface SiteSettingsContextValue {
  defaultCurrency: string;
  isLoading: boolean;
}

export function useSiteSettings(): SiteSettingsContextValue {
  return { defaultCurrency: "AED", isLoading: false };
}

export interface WorkingBranch {
  id: string;
  name: string;
  nameAr: string;
  healthLicense: string | null;
  targetSystem?: string | null;
}

export function useWorkingBranch(): WorkingBranch | null {
  return {
    id: "1",
    name: "ASH Hospital HQ",
    nameAr: "ASH Hospital HQ",
    healthLicense: "DXB",
  };
}

/* ── date helpers, copied verbatim from packages/shared/src/date.ts ── */
/**
 * Convert a `Date` to a "YYYY-MM-DD" string using LOCAL date components.
 *
 * Why: `date.toISOString().slice(0, 10)` converts to UTC first, which shifts the
 * calendar day backward for any user east of UTC (e.g. Saudi Arabia, UTC+3:
 * picking April 27 at local midnight serializes to "2026-04-26"). For date-only
 * fields the user's wall-clock date is what we want to send to the backend.
 */
export function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a "YYYY-MM-DD" string into a `Date` at LOCAL midnight.
 *
 * Why: `new Date("2026-04-27")` is parsed as UTC midnight, which renders as the
 * previous day in negative-offset timezones. Appending "T00:00:00" forces local
 * interpretation so the calendar shows the day the user originally picked.
 */
export function fromIsoDateString(s: string): Date {
  return new Date(`${s}T00:00:00`);
}
