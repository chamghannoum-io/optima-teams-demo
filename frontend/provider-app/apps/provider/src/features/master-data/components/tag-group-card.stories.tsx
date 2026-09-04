import { useState } from "react";

import type { TagGroup } from "../types.js";
import { TagGroupCard } from "./tag-group-card.js";

export default {
  title: "MasterData/TagGroupCard",
  component: TagGroupCard,
};

/** First group: no join-operator selector, no "Remove Group" needed but still removable. */
export function FirstGroup() {
  const [group, setGroup] = useState<TagGroup>({
    id: "g1",
    operator: "OR",
    joinOperator: "AND",
    tags: [{ code: "dep_dental", display: "Dental" }],
  });
  return (
    <TagGroupCard
      group={group}
      groupNumber={1}
      showJoinOperator={false}
      removable
      onChange={setGroup}
      onRemove={() => {}}
    />
  );
}

/** A later group: shows the join-operator selector and the operator selector (2+ tags). */
export function JoinedGroupWithMultipleTags() {
  const [group, setGroup] = useState<TagGroup>({
    id: "g2",
    operator: "OR",
    joinOperator: "AND",
    tags: [
      { code: "dep_dental", display: "Dental" },
      { code: "dep_ontology", display: "Ontology" },
    ],
  });
  return (
    <TagGroupCard
      group={group}
      groupNumber={2}
      showJoinOperator
      removable
      onChange={setGroup}
      onRemove={() => {}}
    />
  );
}
