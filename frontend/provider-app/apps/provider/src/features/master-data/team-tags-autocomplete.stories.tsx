import { useState } from "react";

import { TeamTagsAutocomplete, type TeamTag } from "./team-tags-autocomplete.js";

export default {
  title: "MasterData/TeamTagsAutocomplete",
  component: TeamTagsAutocomplete,
};

/** Empty picker: shows the placeholder until the user opens it. */
export function Empty() {
  const [tags, setTags] = useState<TeamTag[]>([]);
  return <TeamTagsAutocomplete value={tags} onChange={setTags} placeholder="Select tags..." />;
}

/** A few tags already selected: shows chips plus the "clear all" affordance. */
export function WithSelectedTags() {
  const [tags, setTags] = useState<TeamTag[]>([
    { code: "dep_dental", display: "Dental" },
    { code: "dep_ontology", display: "Ontology" },
  ]);
  return <TeamTagsAutocomplete value={tags} onChange={setTags} placeholder="Select tags..." />;
}

/** Disabled state: chips remain visible but the picker can't be opened or edited. */
export function Disabled() {
  const [tags] = useState<TeamTag[]>([{ code: "enc_ip", display: "Inpatient" }]);
  return <TeamTagsAutocomplete value={tags} onChange={() => {}} disabled />;
}
