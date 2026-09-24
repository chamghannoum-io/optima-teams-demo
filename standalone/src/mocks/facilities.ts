/**
 * The facility list, as the business names it.
 *
 * Teams were being configured against `DXB` / `AJM` / `SHJ` / `RAK`, which are
 * not what anyone calls these places. A supervisor picking a facility should
 * see "Saudi German Clinics - Akoya", not a three-letter code.
 *
 * The complication is that a work item arrives carrying a health licence, not a
 * name, and one facility can hold several. SGH-Sharjah has three. So the
 * canonical value is the facility, and every licence it holds is an alias for
 * it, which is the same mechanism the department synonyms already use. Picking
 * one facility therefore matches all of its licences, and the picker shows one
 * row per place rather than one per regulatory number.
 *
 * Names and branch ids come from the captured `optimaTeams` response; the
 * licence sets come from the captured unassigned queue, where each entity
 * carries both `branchId` and `facilityId`. Ten of the sixteen were seen
 * carrying work in that run and have verified licences; the other six are real
 * branches that were simply idle, and are listed without one.
 */

export interface Facility {
  /** Canonical value stored on a criterion, and shown in the picker. */
  name: string;
  /** Upstream branch id, kept so this can be reconciled against Optima. */
  branchId: string;
  /**
   * Health licences this facility bills under. These are what a work item's
   * `facilityId` actually contains, so each one aliases onto the name.
   */
  licences: string[];
  /** Volume profile key. Sites with no observed traffic share the estate mix. */
  siteKey?: string;
}

export const FACILITIES: Facility[] = [
  { name: "Saudi German Hospital", branchId: "3", licences: ["DHA-F-0046775"], siteKey: "DXB" },
  { name: "SGH- Ajman", branchId: "4", licences: ["7510", "MOH-F-1000464"], siteKey: "AJM" },
  {
    name: "SGH- Sharjah",
    branchId: "5",
    licences: ["HF-2026-000943", "MOH-F-1000150", "6927"],
    siteKey: "SHJ",
  },
  { name: "Saudi German Clinics - Jumeirah", branchId: "9", licences: ["DHA-F-3518383"] },
  { name: "Saudi German Clinics - Damac Hills", branchId: "10", licences: ["DHA-F-7809244"] },
  { name: "Saudi German Clinics - Akoya", branchId: "11", licences: ["DHA-F-0101003"] },
  { name: "Saudi German Clinics South Village", branchId: "12", licences: ["DHA-F-1988803"] },
  { name: "Saudi German Clinics Sports City", branchId: "14", licences: ["DHA-F-7137145"] },
  { name: "Al SUYOH", branchId: "19", licences: ["HF-2026-001388", "MOH-F-1000908"] },
  { name: "RAK CLINIC", branchId: "20", licences: ["MOHAP-100167-2025", "MOH-F-1000945"], siteKey: "RAK" },

  /* Real branches with no work in the captured run, so no licence observed. */
  { name: "Saudi German Hospital Pharmacy - Dubai", branchId: "6", licences: [] },
  { name: "Saudi German Hospital Pharmacy - Sharjah", branchId: "7", licences: [] },
  { name: "Saudi German Hospital Pharmacy - Ajman", branchId: "8", licences: [] },
  { name: "Saudi German Clinics Serena", branchId: "13", licences: [] },
  { name: "RAK PHARMACY", branchId: "21", licences: [] },
  { name: "RAK CLINIC Pharmacy - RIAYATI", branchId: "23", licences: [] },
];

/** Lowercase alphanumerics, the same rule the matcher normalises with. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Every spelling that should resolve to a facility: its licences, and the old
 * three-letter site codes so teams configured before this keep matching.
 */
export const FACILITY_ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const f of FACILITIES) {
    const canonical = norm(f.name);
    for (const licence of f.licences) out[norm(licence)] = canonical;
    if (f.siteKey) out[norm(f.siteKey)] = canonical;
  }
  return out;
})();

export const FACILITY_NAMES = FACILITIES.map((f) => f.name);

/** Volume profile for a facility, by name. */
export const siteKeyOf = (name: string): string | undefined =>
  FACILITIES.find((f) => f.name === name)?.siteKey;

/** Which facility a work item's facilityId belongs to, or null if unknown. */
export const facilityOfLicence = (licence: string): string | null => {
  const canonical = FACILITY_ALIASES[norm(licence)];
  return canonical ? (FACILITIES.find((f) => norm(f.name) === canonical)?.name ?? null) : null;
};
