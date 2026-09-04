import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

import {
  cn,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@optima/ui";

import {
  TeamTagsAutocomplete,
  type TeamTagsAutocompleteHandle,
} from "../team-tags-autocomplete.js";
import type { TagGroup, TagOperator } from "../types.js";

export interface TagGroupCardProps {
  /** This group's current state. */
  group: TagGroup;
  /** 1-based position for the "Group N" label. */
  groupNumber: number;
  /** Shows the join-operator selector before the group label; hidden for the first group. */
  showJoinOperator: boolean;
  /** Offers "Remove Group" when true. */
  removable: boolean;
  /** Called with the updated group whenever its tags or an operator changes. */
  onChange: (group: TagGroup) => void;
  /** Called to remove this group entirely. */
  onRemove: () => void;
  className?: string;
}

const OPERATORS: TagOperator[] = ["AND", "OR"];

/**
 * One group card in the tag auto-allocation builder: a join-operator selector (for non-first
 * groups), an operator selector (once the group holds 2+ tags), a "Remove Group" action, and a
 * single multi-select tag picker — adding a tag adds a chip, never a new row/condition. The
 * "Add Tag" button just opens/focuses the picker; it doesn't add a row itself.
 * @example
 * <TagGroupCard group={group} groupNumber={1} showJoinOperator={false} removable
 *   onChange={setGroup} onRemove={remove} />
 */
export function TagGroupCard({
  group,
  groupNumber,
  showJoinOperator,
  removable,
  onChange,
  onRemove,
  className,
}: TagGroupCardProps) {
  const { t } = useTranslation("provider");
  const tagPickerRef = useRef<TeamTagsAutocompleteHandle>(null);

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 dark:border-dark-border p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {showJoinOperator && (
            <Select
              value={group.joinOperator}
              onValueChange={(value) => onChange({ ...group, joinOperator: value as TagOperator })}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400 min-w-fit">
            {t("masterData.teams.tagGroupLabel", { defaultValue: "Group {{n}}", n: groupNumber })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {group.tags.length > 1 && (
            <Select
              value={group.operator}
              onValueChange={(value) => onChange({ ...group, operator: value as TagOperator })}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {removable && (
            <Button variant="outline" size="sm" onClick={onRemove}>
              {t("masterData.teams.removeTagGroup", "Remove Group")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("masterData.teams.tags", "Tags")}
          {group.tags.length > 0 && ` (${group.tags.length})`}
        </span>
        <Button variant="ghost" size="sm" onClick={() => tagPickerRef.current?.open()}>
          <Plus size={14} />
          {t("masterData.teams.addTag", "Add Tag")}
        </Button>
      </div>

      <TeamTagsAutocomplete
        ref={tagPickerRef}
        value={group.tags}
        onChange={(tags) => onChange({ ...group, tags })}
        placeholder={t("masterData.teams.tagsSelectPlaceholder")}
      />
    </div>
  );
}
