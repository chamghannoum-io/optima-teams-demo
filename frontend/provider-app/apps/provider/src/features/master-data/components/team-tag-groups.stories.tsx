import { useState } from "react";

import type { TagGroup } from "../types.js";
import { TeamTagGroups } from "./team-tag-groups.js";

export default {
  title: "MasterData/TeamTagGroups",
  component: TeamTagGroups,
};

/** No groups yet: shows the empty state with an "Add Group" action. */
export function Empty() {
  const [groups, setGroups] = useState<TagGroup[]>([]);
  return <TeamTagGroups groups={groups} onChange={setGroups} />;
}

/** A single group with multiple tags: the operator selector appears once it holds 2+ tags. */
export function SingleGroup() {
  const [groups, setGroups] = useState<TagGroup[]>([
    {
      id: "g1",
      operator: "OR",
      joinOperator: "AND",
      tags: [
        { code: "dep_dental", display: "Dental" },
        { code: "dep_ontology", display: "Ontology" },
      ],
    },
  ]);
  return <TeamTagGroups groups={groups} onChange={setGroups} />;
}

/** Two groups joined by AND — reproduces "(dep_dental OR dep_ontology) AND enc_ip". */
export function MultipleGroups() {
  const [groups, setGroups] = useState<TagGroup[]>([
    {
      id: "g1",
      operator: "OR",
      joinOperator: "AND",
      tags: [
        { code: "dep_dental", display: "Dental" },
        { code: "dep_ontology", display: "Ontology" },
      ],
    },
    {
      id: "g2",
      operator: "OR",
      joinOperator: "AND",
      tags: [{ code: "enc_ip", display: "Inpatient" }],
    },
  ]);
  return <TeamTagGroups groups={groups} onChange={setGroups} />;
}
