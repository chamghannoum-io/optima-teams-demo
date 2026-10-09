/**
 * Three teams, one per way a team can hand a filter to its groups.
 *
 * The seed in `teams-v2-real.json` is the real production estate, migrated up
 * from the v1 shape. Its lock state is now derived in `migrateSeedTeam` from
 * what the v1 data already says , one facility nobody varies is a locked
 * filter, a work item type list every group takes a slice of is an unlocked
 * one , so the estate demonstrates the model too, honestly, without a flag
 * being invented for it.
 *
 * These three are different: written natively in the v3 shape and appended to
 * the store, each one answering "what does the team decide, and what is left
 * to the groups?" a different way, so all three answers sit side by side on
 * one screen rather than having to be inferred from eleven teams that happen
 * to be configured alike.
 *
 *   LOCKED   T-D1. The team names the work item types and locks them, so all
 *            five of its groups do claim validation and claim submission, and
 *            none of them can say otherwise. Four split on department, which
 *            is the dimension the team said nothing about; the fifth splits on
 *            money instead, and is where high cost is demonstrated.
 *
 *   CHOICE   T-D2. The team names three facilities and leaves them unlocked.
 *            That makes facility group-editable even though the registry calls
 *            it a team-level dimension, and each group takes one of the three.
 *            Work item type is locked alongside it, so the two mechanisms are
 *            visible on one team.
 *
 *   OPEN     T-D3. The team filters on nothing at all. Its groups are free to
 *            route on anything, and they pick up reconciliation, which no team
 *            in the real estate handles, split by payer.
 *
 * Members are real people from `people.json`. Some of them are already in a
 * seed team, which is allowed and is what the duplicate-membership warning is
 * for; it makes the demo show that warning rather than hide it.
 */

import type { Criterion } from "./allocation-model.js";

export interface DemoGroup {
  id: string;
  name: string;
  criteria: Criterion[];
  memberIds: string[];
}

export interface DemoTeam {
  id: string;
  name: string;
  description: string;
  active: boolean;
  rotationEnabled: boolean;
  criteria: Criterion[];
  groups: DemoGroup[];
}

const IN = (dimension: string, values: string[], locked = false): Criterion => ({
  dimension,
  operator: "IN",
  values,
  locked,
});

/** The high-cost switch, as the criterion it actually is. */
const OVER = (amount: number): Criterion => ({
  dimension: "CLAIM_VALUE",
  operator: "GREATER_THAN",
  values: [String(amount)],
});

/**
 * Every department the volume table knows, so the locked team can be split
 * exhaustively and readiness has nothing to report about it. Written out
 * rather than imported because a demo whose coverage silently changes with the
 * volume capture is not demonstrating anything.
 */
const MEDICAL = [
  "Internal Medicine",
  "Cardiology Services",
  "Neurology",
  "Rheumatology",
  "Oncology",
  "Oncology/ Hematology",
  "GIHC Oncology",
  "Psychiatry",
];
const SURGICAL = [
  "Surgery",
  "Orthopedics",
  "Neurosurgery",
  "Urology",
  "Dr. Amr El Shawarbi  Neurosurgery Center",
  "Plastic/Briatric Surgery",
  "Dental and Maxillofacial",
  "Anesthesia",
];
const WOMEN_AND_CHILDREN = ["Obstetrics & Gyne & IVF", "Pediatrics & Neonatology"];
const ACUTE_AND_REST = [
  "Emergency",
  "Intensive Care Unit",
  "Intensive Care Unit - ICU",
  "E. N. T.",
  "Ophthalmology",
  "Dermatology",
  "Physiotherapy",
  "Podiatry",
  "Dietician / Nutrition",
  "Cosmetrix",
  "(unresolved)",
];

/*
 * Two disjoint payer sets rather than one set and its complement. The criteria
 * builder has no operator control by design, so a NOT_IN clause would render as
 * though it were an IN one, and a demo that reads as the opposite of what it
 * does is worse than no demo.
 */
const MAJOR_PAYERS = ["INS020", "INS019", "INS017", "INS044", "INS012"];
const SMALLER_PAYERS = ["INS026", "INS005", "INS008", "INS002", "INS022", "INS015", "SelfPay"];

export const DEMO_TEAMS: DemoTeam[] = [
  {
    id: "d1",
    name: "Dubai Claims Desk (locked work types)",
    description:
      "Demonstrates a locked filter. Claim validation and claim submission are set on the team and apply to every group automatically; the groups only choose their departments. One group takes no department at all and instead takes anything over AED 10,000, which is how high cost routes.",
    active: true,
    rotationEnabled: false,
    criteria: [
      IN("FACILITY", ["Saudi German Hospital"], true),
      IN("WORK_ITEM_TYPE", ["CLAIM_VALIDATION", "CLAIM_SUBMISSION"], true),
    ],
    groups: [
      {
        id: "900",
        name: "Medical",
        criteria: [IN("DEPARTMENT", MEDICAL)],
        memberIds: ["VXNlcjo4Mjg=", "VXNlcjo4MzI=", "VXNlcjo4MzA="],
      },
      {
        id: "901",
        name: "Surgical",
        criteria: [IN("DEPARTMENT", SURGICAL)],
        memberIds: ["VXNlcjo4MjY=", "VXNlcjo4NDY=", "VXNlcjo4NDU="],
      },
      {
        id: "902",
        name: "Women and children",
        criteria: [IN("DEPARTMENT", WOMEN_AND_CHILDREN)],
        memberIds: ["VXNlcjo4NDg=", "VXNlcjo4NDQ="],
      },
      {
        id: "903",
        name: "Acute and the rest",
        criteria: [IN("DEPARTMENT", ACUTE_AND_REST)],
        memberIds: ["VXNlcjo4NTQ=", "VXNlcjoxMDU1", "VXNlcjo5Nzk="],
      },
      /*
       * High cost, and the reason it is a criterion rather than a flag.
       *
       * This group names no department, so against the four above it is the
       * wider rule on every axis but one , and that one is enough. "Over AED
       * 10,000" constrains a dimension the others leave open, so
       * `specificityOf` scores it higher and an expensive cardiology claim
       * lands here while a cheap one still goes to Medical. Nothing had to
       * teach the matcher what money is.
       */
      {
        id: "904",
        name: "High value",
        criteria: [OVER(10000)],
        memberIds: ["VXNlcjo4MjY=", "VXNlcjo4NDg="],
      },
    ],
  },
  {
    id: "d2",
    name: "Northern Emirates Resubmission (one facility per group)",
    description:
      "Demonstrates an unlocked filter. The team covers Ajman, Sharjah and RAK, and each group picks one of those three. Work item type is locked, so every group does claim resubmission.",
    active: true,
    rotationEnabled: false,
    criteria: [
      // Unlocked, which is what makes facility editable on the groups below
      // even though the registry declares it a team-level dimension.
      IN("FACILITY", ["SGH- Ajman", "SGH- Sharjah", "RAK CLINIC"]),
      IN("WORK_ITEM_TYPE", ["CLAIM_RESUBMISSION"], true),
    ],
    groups: [
      {
        id: "910",
        name: "Ajman",
        criteria: [IN("FACILITY", ["SGH- Ajman"])],
        memberIds: ["VXNlcjoxMDU3", "VXNlcjoxMDU5"],
      },
      {
        id: "911",
        name: "Sharjah",
        criteria: [IN("FACILITY", ["SGH- Sharjah"])],
        memberIds: ["VXNlcjoxMDU0", "VXNlcjoxMDU2"],
      },
      {
        id: "912",
        name: "RAK",
        criteria: [IN("FACILITY", ["RAK CLINIC"])],
        memberIds: ["VXNlcjoxMDEx", "VXNlcjoxMDEz"],
      },
    ],
  },
  {
    id: "d3",
    name: "Reconciliation Floaters (no team filter)",
    description:
      "Demonstrates no filter at all. The team constrains nothing, so its groups route on whatever they like; here that is reconciliation, which no other team handles, split by payer.",
    active: true,
    rotationEnabled: false,
    criteria: [],
    groups: [
      {
        id: "920",
        name: "Major payers",
        criteria: [IN("WORK_ITEM_TYPE", ["RECONCILIATION"]), IN("PAYER", MAJOR_PAYERS)],
        memberIds: ["VXNlcjoxMDEw", "VXNlcjoxMDEy"],
      },
      {
        id: "921",
        name: "Smaller payers and self-pay",
        criteria: [IN("WORK_ITEM_TYPE", ["RECONCILIATION"]), IN("PAYER", SMALLER_PAYERS)],
        memberIds: ["VXNlcjoxMDE0"],
      },
    ],
  },
];
