/**
 * Renames the v2 seed teams back to production-style names.
 *
 * The `DXB · AUTH · OP` names were not production's, they were synthesised by our
 * own v1→v2 migration when a team became a facility × division × encounter
 * container. Production calls these teams things like "Authorization Team OP
 * (Dubai)" and "Medical Coders (OP)", which is what teams-real.json shows.
 *
 * Now that the scope lives in criteria and the list shows name + description,
 * a name that restates the filters is both redundant and actively misleading.
 * Group names lose their facility suffix for the same reason: the team already
 * scopes them.
 *
 *   node scripts/rename-seed-teams.mjs
 */
import fs from "node:fs";
import path from "node:path";

const SEED = path.join(process.cwd(), "src", "mocks", "teams-v2-real.json");

const SITE = { DXB: "Dubai", AJM: "Ajman", SHJ: "Sharjah", RAK: "Ras Al Khaimah" };

/** Reads like the master data it stands in for, and says what the team is for. */
const nameFor = (t) => {
  const site = SITE[t.facilityId] ?? t.facilityId;
  const kind = t.division === "AUTH" ? "Authorization Team" : "Claims Team";
  const enc = t.encounterScope === "BOTH" ? "" : ` ${t.encounterScope}`;
  return `${kind}${enc} (${site})`;
};

const descriptionFor = (t) => {
  const site = SITE[t.facilityId] ?? t.facilityId;
  const enc =
    t.encounterScope === "BOTH"
      ? "inpatient and outpatient"
      : t.encounterScope === "IP"
        ? "inpatient"
        : "outpatient";
  return t.division === "AUTH"
    ? `Authorisation submissions and resubmissions for ${site} ${enc} encounters, split by department.`
    : `Coding, submission and resubmission for ${site} ${enc} claims.`;
};

/** "Submission - DXB" -> "Submission". The team already says where. */
const groupName = (n) => n.replace(/\s*[-–—]\s*(DXB|AJM|SHJ|RAK)\s*$/i, "").trim();

const teams = JSON.parse(fs.readFileSync(SEED, "utf8"));
let renamed = 0;
for (const t of teams) {
  const before = t.name;
  t.name = nameFor(t);
  t.description = descriptionFor(t);
  t.nameAr = null;
  for (const g of t.groups ?? []) g.name = groupName(g.name);
  if (before !== t.name) renamed += 1;
  console.log(`  ${before.padEnd(22)} -> ${t.name}`);
}

fs.writeFileSync(SEED, JSON.stringify(teams, null, 2) + "\n");
console.log(`\n${renamed} teams renamed in ${path.basename(SEED)}`);
