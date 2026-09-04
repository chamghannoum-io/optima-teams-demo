import { useTranslation } from "react-i18next";

import { cn, Button, Label } from "@optima/ui";

import type { TagGroup } from "../types.js";
import { TagGroupCard } from "./tag-group-card.js";

export interface TeamTagGroupsProps {
  /** Current tag groups, in join order. */
  groups: TagGroup[];
  /** Called with the full list whenever a group's tags/operators change, or a group is added/removed. */
  onChange: (groups: TagGroup[]) => void;
  className?: string;
}

/**
 * Auto-allocation tag builder: one or more groups, each a single multi-select of tags combined
 * by AND/OR, and each group itself joined to the previous by another AND/OR — e.g.
 * "(dep_dental OR dep_ontology) AND enc_ip". Adding a tag to a group adds a chip, never a new
 * row. Replaces the old flat tag chip list.
 * @example <TeamTagGroups groups={groups} onChange={setGroups} />
 */
export function TeamTagGroups({ groups, onChange, className }: TeamTagGroupsProps) {
  const { t } = useTranslation("provider");

  const addGroup = () => {
    onChange([
      ...groups,
      { id: crypto.randomUUID(), tags: [], operator: "OR", joinOperator: "AND" },
    ]);
  };

  const updateGroup = (groupIndex: number, group: TagGroup) => {
    onChange(groups.map((g, i) => (i === groupIndex ? group : g)));
  };

  const removeGroup = (groupIndex: number) => {
    onChange(groups.filter((_, i) => i !== groupIndex));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label>{t("masterData.teams.tagGroups", "Tag Groups")}</Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "masterData.teams.tagGroupsHint",
              "Add tags to a group and choose how they combine; add another group and choose how it joins the one before it."
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addGroup}>
          {t("masterData.teams.addTagGroup", "Add Group")}
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 dark:border-dark-border p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "masterData.teams.noTagGroups",
              "No tag groups yet. Add one above to configure auto-allocation."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, groupIndex) => (
            <TagGroupCard
              key={group.id}
              group={group}
              groupNumber={groupIndex + 1}
              showJoinOperator={groupIndex > 0}
              removable
              onChange={(next) => updateGroup(groupIndex, next)}
              onRemove={() => removeGroup(groupIndex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
