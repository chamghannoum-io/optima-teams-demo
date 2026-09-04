// ── Shared helpers for claim/validation detail views ─────────────────────

export function getPriorityVariant(priority: string | null | undefined) {
  switch (priority) {
    case "HIGH":
      return "error" as const;
    case "MEDIUM":
      return "warning" as const;
    case "LOW":
      return "info" as const;
    default:
      return "default" as const;
  }
}

export function getPriorityBorder(priority: string | null | undefined) {
  switch (priority) {
    case "HIGH":
      return "border-l-red-500";
    case "MEDIUM":
      return "border-l-amber-500";
    case "LOW":
      return "border-l-blue-500";
    default:
      return "border-l-gray-400";
  }
}

// ── AI edit confidence resolution (OPTIMA-3017) ─────────────────────────
// AI engine returns `confidenceColor` on all AI edits. Normalized display:
//   High   → Red or Orange
//   Medium → Yellow
//   Hidden → White (edit not rendered at all)
//   Default → non-AI edit, show raw confidenceColor label if present

export type EditDisplayState = "low" | "medium" | "high" | "hidden" | "default";

interface EditDisplayInput {
  id?: string | null;
  isAi?: boolean | null;
  edit?: { code?: string | null } | null;
  confidenceColor?: string | null;
}

function normalizeColor(raw: string): EditDisplayState {
  switch (raw.toLowerCase()) {
    case "red":
    case "orange":
      return "high";
    case "yellow":
      return "medium";
    case "white":
      return "hidden";
    default:
      return "default";
  }
}

export function getAiEditDisplay(input: EditDisplayInput | null | undefined): EditDisplayState {
  if (!input || !input.isAi || !input.confidenceColor?.trim()) return "default";
  return normalizeColor(input.confidenceColor.trim());
}

export function isEditVisible(input: EditDisplayInput | null | undefined): boolean {
  return getAiEditDisplay(input) !== "hidden";
}

// Per-level badge styles used directly in edit-card JSX.
// Colors mirror the engine's category: RED→High, ORANGE→Medium, YELLOW→Low.
export const CONFIDENCE_STYLES = {
  high: {
    badge: "bg-red-100    text-red-700    dark:bg-red-500/20    dark:text-red-300",
    label: "Confidence: High",
  },
  medium: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    label: "Confidence: Medium",
  },
  low: {
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
    label: "Confidence: Low",
  },
} as const;

// For non-AI edits that carry a raw confidenceColor string from the backend —
// returns the string as-is for display. AI edits use CONFIDENCE_STYLES instead.
export function getDisplayConfidenceColor(
  input: EditDisplayInput | null | undefined
): string | null {
  if (!input || input.isAi) return null;
  return input.confidenceColor?.trim() || null;
}

// AI confidenceColor overrides the edit's own priority when present:
//   Red/Orange → HIGH
//   Yellow     → MEDIUM
// Otherwise falls back to the provided edit priority.
export function getEffectivePriority(
  input: EditDisplayInput | null | undefined,
  fallback?: string | null
): string | null {
  const state = getAiEditDisplay(input);
  if (state === "high") return "HIGH";
  if (state === "medium") return "MEDIUM";
  return fallback ?? null;
}

export function resolveExtraData(
  text: string,
  extraData: string | null | undefined,
  mandatoryDocuments?: ReadonlyArray<string | null> | null
): string {
  if (!text) return text;

  let data: Record<string, string> = {};
  if (extraData) {
    try {
      data = JSON.parse(extraData) as Record<string, string>;
    } catch {
      // leave data empty; fall through to placeholder-only handling
    }
  }

  const docs = mandatoryDocuments?.filter((d): d is string => Boolean(d)) ?? [];

  return text
    .replace(/<<([^>]+)>>/g, (_match, key: string) => {
      const value = data[key];
      if (value !== undefined) return value;
      if (key === "Missing Document List" && docs.length > 0) {
        return docs.join(", ");
      }
      return "";
    })
    .replace(/ {2,}/g, " ")
    .trim();
}
