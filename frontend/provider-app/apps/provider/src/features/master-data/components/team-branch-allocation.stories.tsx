import { useState } from "react";

import { Input } from "@optima/ui";
import type { IBaseOption } from "@optima/shared";

import { TeamBranchAllocation } from "./team-branch-allocation.js";

export default {
  title: "MasterData/TeamBranchAllocation",
  component: TeamBranchAllocation,
};

const SAMPLE_BRANCHES: IBaseOption[] = [
  { key: "b1", label: "Riyadh Main Hospital", value: "b1" },
  { key: "b2", label: "Jeddah Clinic", value: "b2" },
  { key: "b3", label: "Dammam Facility", value: "b3" },
];

/** Combined section: picker slot on top, drag-reorderable and removable list below. */
export function Default() {
  const [branches, setBranches] = useState(SAMPLE_BRANCHES);
  return (
    <TeamBranchAllocation branches={branches} onChange={setBranches} required>
      <Input placeholder="Search branches… (picker slot)" readOnly />
    </TeamBranchAllocation>
  );
}

/** Empty state shown before any branch is added. */
export function Empty() {
  const [branches, setBranches] = useState<IBaseOption[]>([]);
  return (
    <TeamBranchAllocation branches={branches} onChange={setBranches}>
      <Input placeholder="Search branches… (picker slot)" readOnly />
    </TeamBranchAllocation>
  );
}
