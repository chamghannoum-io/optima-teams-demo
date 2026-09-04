import { OptimaTagOperation, type OptimaTeamTagInput } from "@/__generated__/graphql";
import type { MemberUnavailability, RotationFrequency, TagGroup, TagOperator } from "./types.js";

/**
 * Returns the date of the next rotation run for `frequency`, counted from `from` (defaults to today).
 * Mirrors the backend computation: DAILY → tomorrow, WEEKLY → next Monday,
 * MONTHLY → first weekday (Mon–Fri) of the next month.
 */
export function getNextRotationDate(frequency: RotationFrequency, from: Date = new Date()): Date {
  const next = new Date(from);
  next.setHours(0, 0, 0, 0);
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY": {
      // Days until next Monday; a full week when today already is Monday
      const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
      break;
    }
    case "MONTHLY": {
      next.setMonth(next.getMonth() + 1, 1);
      if (next.getDay() === 6) next.setDate(3); // Saturday → Monday
      if (next.getDay() === 0) next.setDate(2); // Sunday → Monday
      break;
    }
  }
  return next;
}

/** Formats a date as DD/MM/YYYY for rotation and unavailability labels. */
export function formatDayMonthYear(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Formats a date as the YYYY-MM-DD string the API's LocalDate scalar expects, using local time parts. */
export function formatIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Parses a YYYY-MM-DD LocalDate scalar value into a local-midnight Date (avoids UTC shifting). */
export function parseIsoDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Returns a copy of `items` with the element at `index` swapped one position up or down; no-op at the edges. */
export function moveItem<T>(items: readonly T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  const moved = next[index] as T;
  next[index] = next[target] as T;
  next[target] = moved;
  return next;
}

/** True when the two date windows share at least one calendar day (inclusive on both ends). */
export function unavailabilityRangesOverlap(
  a: Pick<MemberUnavailability, "startDate" | "endDate">,
  b: Pick<MemberUnavailability, "startDate" | "endDate">
): boolean {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return day(a.startDate) <= day(b.endDate) && day(b.startDate) <= day(a.endDate);
}

/** True while the window's end date has not passed yet (day-inclusive): the member's active or upcoming window. */
export function isUnavailabilityOngoing(
  period: Pick<MemberUnavailability, "endDate">,
  on: Date = new Date()
): boolean {
  const end = new Date(period.endDate);
  end.setHours(23, 59, 59, 999);
  return on <= end;
}

/** Builds the legacy flat `rcm_team.tag` value from all tag codes, deduped. */
export function buildFlatTagList(groups: readonly TagGroup[]): string {
  const codes = groups.flatMap((group) => group.tags).map((tag) => tag.code);
  return [...new Set(codes)].join(", ");
}

/** Converts editable groups to the backend `OptimaTeamTagInput[]` tree. */
export function buildTeamTagsInput(groups: readonly TagGroup[]): OptimaTeamTagInput[] {
  const toApiOperation = (operator: TagOperator): OptimaTagOperation =>
    operator === "OR" ? OptimaTagOperation.Or : OptimaTagOperation.And;
  const leafNode = (code: string): OptimaTeamTagInput => ({
    tag: code,
    isGroup: false,
    tagOperation: null,
    tags: [],
  });
  const buildGroupNode = (group: TagGroup): OptimaTeamTagInput | null => {
    const codes = group.tags.map((tag) => tag.code);
    if (codes.length === 0) return null;
    if (codes.length === 1) return leafNode(codes[0]!);
    return {
      tag: null,
      isGroup: true,
      tagOperation: toApiOperation(group.operator),
      tags: codes.map((code) => leafNode(code)),
    };
  };

  const groupNodes: { node: OptimaTeamTagInput; joinOperator: TagOperator }[] = [];
  groups.forEach((group) => {
    const node = buildGroupNode(group);
    if (node) groupNodes.push({ node, joinOperator: group.joinOperator });
  });
  if (groupNodes.length === 0) return [];

  let acc = groupNodes[0]!.node;
  for (let i = 1; i < groupNodes.length; i++) {
    acc = {
      tag: null,
      isGroup: true,
      tagOperation: toApiOperation(groupNodes[i]!.joinOperator),
      tags: [acc, groupNodes[i]!.node],
    };
  }
  return [acc];
}

/** Minimal tree shape shared by `OptimaTeamTag` and `OptimaTeamTagInput`. */
interface TeamTagNode {
  tag?: string | null;
  isGroup?: boolean | null;
  tagOperation?: OptimaTagOperation | null;
  tags?: readonly TeamTagNode[] | null;
}

/** Unfolds a `buildTeamTagsInput` binary fold back into ordered group nodes. */
function unfoldChain(node: TeamTagNode): { node: TeamTagNode; joinOperator: TagOperator }[] {
  const fromApiOperation = (operation: OptimaTagOperation | null | undefined): TagOperator =>
    operation === OptimaTagOperation.Or ? "OR" : "AND";
  const isSimpleGroupNode = (current: TeamTagNode): boolean =>
    !current.isGroup || (current.tags ?? []).every((child) => !child.isGroup);
  const flattenToSimpleGroup = (current: TeamTagNode): TeamTagNode => {
    const codes: string[] = [];
    const walk = (item: TeamTagNode) => {
      if (!item.isGroup && item.tag) codes.push(item.tag);
      else (item.tags ?? []).forEach(walk);
    };
    walk(current);
    return {
      tag: null,
      isGroup: true,
      tagOperation: OptimaTagOperation.Or,
      tags: codes.map((tag) => ({ tag, isGroup: false })),
    };
  };

  if (isSimpleGroupNode(node)) {
    return [{ node, joinOperator: "AND" }];
  }
  const children = node.tags ?? [];
  const right = children[1];
  if (children.length !== 2 || !right || !isSimpleGroupNode(right)) {
    // Not our fold shape — flatten every leaf into one best-effort group.
    return [{ node: flattenToSimpleGroup(node), joinOperator: "AND" }];
  }
  const left = children[0]!;
  return [...unfoldChain(left), { node: right, joinOperator: fromApiOperation(node.tagOperation) }];
}

function nodeToTagGroup(node: TeamTagNode, joinOperator: TagOperator, index: number): TagGroup {
  const fromApiOperation = (operation: OptimaTagOperation | null | undefined): TagOperator =>
    operation === OptimaTagOperation.Or ? "OR" : "AND";
  if (!node.isGroup) {
    return {
      id: `group-${index}`,
      tags: node.tag ? [{ code: node.tag, display: node.tag }] : [],
      operator: "OR",
      joinOperator,
    };
  }
  const tags = (node.tags ?? [])
    .filter((child): child is TeamTagNode & { tag: string } => !child.isGroup && !!child.tag)
    .map((child) => ({ code: child.tag, display: child.tag }));
  return {
    id: `group-${index}`,
    tags,
    operator: fromApiOperation(node.tagOperation),
    joinOperator,
  };
}

/** Parses backend `team.tags` into editable groups, with best-effort flattening on unknown shapes. */
export function parseTeamTags(nodes: readonly TeamTagNode[] | null | undefined): TagGroup[] {
  if (!nodes || nodes.length === 0) return [];
  const chain = nodes.flatMap((node) => unfoldChain(node));
  return chain.map((item, index) =>
    nodeToTagGroup(item.node, index === 0 ? "AND" : item.joinOperator, index)
  );
}