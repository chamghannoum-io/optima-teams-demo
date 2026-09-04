/**
 * Stands in for react-i18next.
 *
 * Humanises the key's last segment. The real app ships translation catalogues; the
 * demo shows readable English derived from the keys instead.
 */
const LABELS: Record<string, string> = {
  "masterData.teams.title": "Teams",
  "masterData.teams.members": "Members",
  "masterData.teams.member": "Member",
  "masterData.teams.noResults": "No teams found",
  "masterData.teams.stepTeamInfo": "Team Info",
  "masterData.teams.stepMembers": "Members",
  "masterData.teams.stepSettings": "Settings",
  "masterData.teams.stepReview": "Review",
  "common.description": "Description",
  "common.createdAt": "Created",
  "common.status": "Status",
  "common.actions": "Actions",
  "common.active": "Active",
  "common.inactive": "Inactive",
  "common.edit": "Edit",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.next": "Next",
  "common.back": "Back",
  "common.close": "Close",
  "common.error": "Error",
  "common.team": "teams",
};

function translate(key: string, opts?: any): string {
  if (LABELS[key]) {
    const base = LABELS[key];
    return opts && typeof opts.count === "number" ? `${opts.count} ${base}` : base;
  }
  if (opts?.defaultValue) return String(opts.defaultValue);
  const leaf = String(key).split(".").pop() ?? String(key);
  const words = leaf.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  const text = words.charAt(0).toUpperCase() + words.slice(1);
  return opts && typeof opts === "object"
    ? text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ""))
    : text;
}

export function useTranslation(_ns?: string) {
  return { t: translate, i18n: { language: "en", dir: () => "ltr" as const } };
}
export const Trans = ({ children }: any) => children ?? null;
