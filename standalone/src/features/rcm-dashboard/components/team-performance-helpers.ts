import type { QueueDashboardMemberRow } from "@/__generated__/graphql";

// ── Avatar helpers ────────────────────────────────────────────────────
export const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-pink-500",
];

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Resolve a member's display name. Falls back to the user id when the
 * server returns no name so rows aren't rendered as bare placeholders.
 */
export function resolveMemberName(row: { userName?: string | null; userId: string }): string {
  const name = row.userName?.trim();
  return name && name.length > 0 ? name : row.userId;
}

export function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Domain types ──────────────────────────────────────────────────────
export type MemberRow = QueueDashboardMemberRow;

/**
 * Combined resubmissions count = claim + auth resubmissions.
 *
 * Why: BE splits the count into `claimResubmissionsAssigned` and
 * `authorizationResubmissionsAssigned`. UI surfaces still display a single
 * "Resubs" column/tile, so we recombine here. One place to change if the
 * product later wants two columns.
 *
 * Returns null when both fields are null (caller's workItemTypes filter
 * excluded both resubmission types), matching the schema's "hidden" signal.
 */
export function getResubmissionsAssigned(row: {
  claimResubmissionsAssigned?: number | string | null;
  authorizationResubmissionsAssigned?: number | string | null;
}): number | null {
  const c = row.claimResubmissionsAssigned;
  const a = row.authorizationResubmissionsAssigned;
  if (c == null && a == null) return null;
  return Number(c ?? 0) + Number(a ?? 0);
}

/**
 * Combined claims count = claim submissions + claim validations (pre-claims).
 *
 * Why: BE splits CLAIM_SUBMISSION (`claimsAssigned`) from CLAIM_VALIDATION
 * (`claimValidationsAssigned`). The UI surfaces both under a single "Claims"
 * column/tile after the pre-claims/claims merge, so we recombine here.
 */
export function getClaimsAssigned(row: {
  claimsAssigned?: number | string | null;
  claimValidationsAssigned?: number | string | null;
}): number {
  return Number(row.claimsAssigned ?? 0) + Number(row.claimValidationsAssigned ?? 0);
}

export type ViewMode = "table" | "cards" | "heatmap";
export type GroupKey = "none" | "status" | "load";
export type FilterKey = "all" | "overdue";
export type SortField =
  | "userName"
  | "claimsAssigned"
  | "authorizationsAssigned"
  | "resubmissionsAssigned"
  | "totalAssigned"
  | "completed"
  | "overdue";

export const PAGE_SIZE = 20;
export const MAX_COMPARE = 3;

// ── Filter chip definitions ───────────────────────────────────────────
// BA: drop the duplicate "High" filter. Keep "Overdue" — the actionable signal
// for Phase 1 (isOverlimit is always false server-side until Phase 2 capacity).
export const FILTER_CHIPS: { key: FilterKey; labelKey: string; defaultLabel: string }[] = [
  { key: "all", labelKey: "rcmDashboard.filterAll", defaultLabel: "All" },
  { key: "overdue", labelKey: "rcmDashboard.filterHasOverdue", defaultLabel: "Overdue" },
];

// ── Filter predicate ──────────────────────────────────────────────────
export function applyFilter(rows: MemberRow[], filter: FilterKey): MemberRow[] {
  switch (filter) {
    case "overdue":
      return rows.filter((r) => Number(r.overdue ?? 0) > 0);
    case "all":
    default:
      return rows;
  }
}

// ── Filter counts (for chip badges) ───────────────────────────────────
export function computeFilterCounts(rows: MemberRow[]): Record<FilterKey, number> {
  return {
    all: rows.length,
    overdue: rows.filter((r) => Number(r.overdue ?? 0) > 0).length,
  };
}

// ── Load buckets ──────────────────────────────────────────────────────
export function loadBucket(total: number): "none" | "light" | "active" | "heavy" {
  if (total === 0) return "none";
  if (total < 5) return "light";
  if (total < 20) return "active";
  return "heavy";
}

export const LOAD_BUCKET_LABEL: Record<ReturnType<typeof loadBucket>, string> = {
  none: "No assignments",
  light: "Light (1–4)",
  active: "Active (5–19)",
  heavy: "Heavy (20+)",
};

// ── Sort ──────────────────────────────────────────────────────────────
export function applySort(rows: MemberRow[], field: SortField, dir: "asc" | "desc"): MemberRow[] {
  const list = [...rows];
  const pick = (row: MemberRow): number | string => {
    if (field === "resubmissionsAssigned") return getResubmissionsAssigned(row) ?? 0;
    if (field === "claimsAssigned") return getClaimsAssigned(row);
    return row[field] ?? 0;
  };
  list.sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    let cmp: number;
    if (typeof av === "string" && typeof bv === "string") {
      cmp = av.localeCompare(bv);
    } else {
      cmp = Number(av) - Number(bv);
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return list;
}

// ── Group ─────────────────────────────────────────────────────────────
export interface GroupEntry {
  key: string;
  label: string;
  members: MemberRow[];
}

export function groupRows(rows: MemberRow[], groupBy: GroupKey): GroupEntry[] {
  if (groupBy === "none") return [{ key: "all", label: "", members: rows }];

  if (groupBy === "status") {
    const overlimit = rows.filter((r) => r.isOverlimit);
    const rest = rows.filter((r) => !r.isOverlimit);
    const groups: GroupEntry[] = [];
    if (overlimit.length) groups.push({ key: "overlimit", label: "Overlimit", members: overlimit });
    // BA: drop the "OK" group header — empty label renders no banner row.
    if (rest.length) groups.push({ key: "ok", label: "", members: rest });
    return groups;
  }

  // groupBy === "load"
  type LoadKey = "none" | "light" | "active" | "heavy";
  const buckets: Record<LoadKey, MemberRow[]> = {
    none: [],
    light: [],
    active: [],
    heavy: [],
  };
  for (const r of rows) buckets[loadBucket(Number(r.totalAssigned ?? 0))].push(r);
  const order: LoadKey[] = ["heavy", "active", "light", "none"];
  return order
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({
      key: k,
      label: LOAD_BUCKET_LABEL[k],
      members: buckets[k],
    }));
}
