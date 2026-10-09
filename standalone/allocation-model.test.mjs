/**
 * The model's own rules, the ones with no workflow counterpart.
 *
 * `matcher-parity.test.mjs` covers everything the nightly run also implements.
 * What is left over is the rules only the app has: which dimensions an admin is
 * offered at each level, and what a team's lock does to that. Those decide what
 * can be configured at all, so a bug in them is invisible to every matcher test
 * , the rule that was never expressible simply never shows up.
 *
 *   node allocation-model.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, ".model-test-bundle.mjs");
await build({
  entryPoints: [path.join(here, "src/mocks/allocation-model.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const M = await import(`${new URL(`file://${outfile.replace(/\\/g, "/")}`)}?t=${Date.now()}`);

let pass = 0;
let fail = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const DIMS = M.DIMENSIONS;
const ALL = DIMS.map((d) => d.code);
const IN = (dimension, values, locked = false) => ({
  dimension,
  operator: "IN",
  values,
  locked,
});

console.log("filter modes");
check("absent clause is OPEN", M.filterModeOf([], "FACILITY"), "OPEN");
check("present and unlocked is CHOICE", M.filterModeOf([IN("FACILITY", ["a"])], "FACILITY"), "CHOICE");
check("present and locked is LOCKED", M.filterModeOf([IN("FACILITY", ["a"], true)], "FACILITY"), "LOCKED");
check("locked dimensions listed", M.lockedDimensions([IN("FACILITY", ["a"], true), IN("PAYER", ["b"])]), ["FACILITY"]);

console.log("what a group may filter on");
// The whole rule: the lock withholds a dimension, nothing else does.
check("a team that filters nothing leaves every dimension open", M.groupEditableDimensions(DIMS, []), ALL);
check("so does an undefined rule", M.groupEditableDimensions(DIMS, undefined), ALL);
/*
 * The regression this file was written for. FACILITY is declared TEAM-level in
 * the registry, and reading that as a group-side restriction too meant a team
 * with no facility filter had groups that could not route by facility either:
 * unreachable from both ends, and the work went wherever.
 */
check(
  "a team-level dimension is still offered to groups when the team says nothing",
  M.groupEditableDimensions(DIMS, []).includes("FACILITY"),
  true,
);
check(
  "an unlocked filter keeps the dimension editable",
  M.groupEditableDimensions(DIMS, [IN("FACILITY", ["SGH- Ajman", "SGH- Sharjah"])]).includes("FACILITY"),
  true,
);
check(
  "a locked filter withholds exactly that dimension",
  ALL.filter(
    (c) => !M.groupEditableDimensions(DIMS, [IN("WORK_ITEM_TYPE", ["CLAIM_VALIDATION"], true)]).includes(c),
  ),
  ["WORK_ITEM_TYPE"],
);
check(
  "locking several withholds several",
  ALL.filter(
    (c) =>
      !M.groupEditableDimensions(DIMS, [
        IN("FACILITY", ["Saudi German Hospital"], true),
        IN("WORK_ITEM_TYPE", ["CLAIM_VALIDATION"], true),
      ]).includes(c),
  ),
  ["FACILITY", "WORK_ITEM_TYPE"],
);

console.log("what a team may filter on");
// `level` keeps its one remaining job: the team side. A department is chosen by
// the people doing the work, not declared for the whole team.
check(
  "group-only dimensions are not offered on a team",
  DIMS.filter((d) => d.level === "GROUP").map((d) => d.code),
  ["DEPARTMENT", "PAYER", "CLAIM_STATUS", "ITEM_VALUE"],
);

console.log("high cost, as a criterion");
// The switch stores a clause, so everything that reads a rule reads this one
// too. These are the properties the group card and the matcher both rely on.
const OVER = (n) => ({ dimension: "ITEM_VALUE", operator: "GREATER_THAN", values: [String(n)] });
const DEPT = (vals) => IN("DEPARTMENT", vals);

check("the switch round-trips through the rule", M.highCostOf(M.withHighCost([], 5000)), 5000);
check("turning it off removes the clause", M.withHighCost(M.withHighCost([], 5000), null), []);
check("no clause means no threshold", M.highCostOf([DEPT(["Cardiology"])]), null);
check(
  "it does not disturb the other clauses",
  M.withHighCost([DEPT(["Cardiology"])], 5000).map((c) => c.dimension),
  ["DEPARTMENT", "ITEM_VALUE"],
);

check("over the amount is admitted", M.criteriaAccept([OVER(5000)], { net: 7400 }), true);
check("under it is not", M.criteriaAccept([OVER(5000)], { net: 1200 }), false);
check("exactly it is not", M.criteriaAccept([OVER(5000)], { net: 5000 }), false);
// An item whose value never arrived must fall to a group that is not
// filtering on value, not count as cheap. Same asymmetry IN has.
check("an item with no value is not admitted", M.criteriaAccept([OVER(5000)], { net: null }), false);

// This is the whole reason high cost is a criterion: the tie-break already
// knows that constraining one more dimension wins.
check(
  "a high-cost group beats the plain one on the expensive claim",
  M.specificityOf([DEPT(["Cardiology"]), OVER(10000)]) >
    M.specificityOf([DEPT(["Cardiology"])]),
  true,
);
check(
  "it reads as money in the chip text",
  M.describeCriteria([OVER(10000)]),
  ["Work item value: over 10,000 AED"],
);

console.log("duplicate group rules");
// Identical rules are legal. Identical rules with one person in both are not,
// and the person is the thing worth naming.
const sara = { id: "u1", firstName: "Sara" };
const omar = { id: "u2", firstName: "Omar" };
const g = (name, criteria, members) => ({ id: name, name, active: true, criteria, members });

check(
  "identical rules with no shared member are not flagged",
  M.duplicateRuleConflicts([
    g("Shift A", [DEPT(["Cardiology"])], [sara]),
    g("Shift B", [DEPT(["Cardiology"])], [omar]),
  ]),
  [],
);
check(
  "a shared member on identical rules names that member",
  M.duplicateRuleConflicts([
    g("Shift A", [DEPT(["Cardiology"])], [sara, omar]),
    g("Shift B", [DEPT(["Cardiology"])], [sara]),
  ]).map((d) => d.members.map((m) => m.name)),
  [["Sara"]],
);
check(
  "clause order does not make two identical rules look different",
  M.duplicateRuleConflicts([
    g("A", [DEPT(["Cardiology"]), OVER(5000)], [sara]),
    g("B", [OVER(5000), DEPT(["Cardiology"])], [sara]),
  ]).length,
  1,
);
// Overlap is not duplication. Partial overlap is what narrowest-wins is for.
check(
  "different rules sharing a member are not flagged",
  M.duplicateRuleConflicts([
    g("A", [DEPT(["Cardiology", "Neurology"])], [sara]),
    g("B", [DEPT(["Cardiology"])], [sara]),
  ]),
  [],
);
// A supervisor is put in every group on purpose, so counting them would fire
// this on every team that has one and say nothing about the duplicate.
check(
  "the team's supervisor does not count as a repeated member",
  M.duplicateRuleConflicts(
    [
      g("A", [DEPT(["Cardiology"])], [sara, omar]),
      g("B", [DEPT(["Cardiology"])], [sara]),
    ],
    [],
    ["u1"],
  ),
  [],
);
check(
  "but a supervisor of ANOTHER team still counts here",
  M.duplicateRuleConflicts(
    [
      g("A", [DEPT(["Cardiology"])], [sara, omar]),
      g("B", [DEPT(["Cardiology"])], [sara]),
    ],
    [],
    ["u2"],
  ).map((d) => d.members.map((m) => m.name)),
  [["Sara"]],
);
// What the team locked is part of the group's real rule, so two groups left
// looking different by a clause the team overrides are still duplicates.
check(
  "the team's locked clauses count towards the comparison",
  M.duplicateRuleConflicts(
    [
      g("A", [DEPT(["Cardiology"])], [sara]),
      g("B", [DEPT(["Cardiology"])], [sara]),
    ],
    [IN("WORK_ITEM_TYPE", ["CLAIM_SUBMISSION"], true)],
  ).length,
  1,
);

fs.rmSync(outfile, { force: true });
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
