import { useTranslation } from "react-i18next";
import { RefreshCw, TriangleAlert } from "lucide-react";

import {
  cn,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@optima/ui";

import { MIN_ROTATION_MEMBERS, ROTATION_FREQUENCIES } from "../constants.js";
import type { RotationFrequency } from "../types.js";
import { formatDayMonthYear, getNextRotationDate } from "../utils.js";

export interface TeamRotationSettingsProps {
  /** Whether rotation is currently turned on. */
  enabled: boolean;
  /** Selected rotation cadence. */
  frequency: RotationFrequency;
  /** Number of members currently in the team scope; rotation needs at least two. */
  memberCount: number;
  /** Server-computed next rotation date; when absent the label falls back to a client-side estimate. */
  nextRotationDate?: Date;
  onEnabledChange: (enabled: boolean) => void;
  onFrequencyChange: (frequency: RotationFrequency) => void;
  /** Prefix for element ids so the panel can appear in several drawers on one page. */
  idPrefix?: string;
  className?: string;
}

/**
 * Rotation panel for the Team Info step: ON/OFF toggle, frequency selector and
 * next-rotation label; blocks enabling when fewer than two members are in scope.
 * @example <TeamRotationSettings enabled frequency="WEEKLY" memberCount={3} onEnabledChange={…} onFrequencyChange={…} />
 */
export function TeamRotationSettings({
  enabled,
  frequency,
  memberCount,
  nextRotationDate,
  onEnabledChange,
  onFrequencyChange,
  idPrefix = "team",
  className,
}: TeamRotationSettingsProps) {
  const { t } = useTranslation("provider");
  const hasEnoughMembers = memberCount >= MIN_ROTATION_MEMBERS;
  const frequencyLabels: Record<RotationFrequency, string> = {
    DAILY: t("masterData.teams.rotationDaily", "Daily"),
    WEEKLY: t("masterData.teams.rotationWeekly", "Weekly"),
    MONTHLY: t("masterData.teams.rotationMonthly", "Monthly"),
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 dark:border-dark-border p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor={`${idPrefix}-rotation-toggle`}>
            {t("masterData.teams.rotation", "Rotation")}
          </Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "masterData.teams.rotationHint",
              "Automatically rotate allocated work between team members on a schedule."
            )}
          </p>
        </div>
        <Switch
          id={`${idPrefix}-rotation-toggle`}
          checked={enabled}
          // A supervisor can always turn rotation OFF; only enabling requires 2+ members
          disabled={!enabled && !hasEnoughMembers}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {!hasEnoughMembers && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 shrink-0" size={14} />
          {t("masterData.teams.rotationMinMembersMessage", {
            defaultValue:
              "Rotation cannot be performed — at least {{min}} users are required in the team scope.",
            min: MIN_ROTATION_MEMBERS,
          })}
        </p>
      )}

      {enabled && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-rotation-frequency`}>
              {t("masterData.teams.rotationFrequency", "Frequency")}
            </Label>
            <Select
              value={frequency}
              onValueChange={(value) => onFrequencyChange(value as RotationFrequency)}
            >
              <SelectTrigger id={`${idPrefix}-rotation-frequency`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROTATION_FREQUENCIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {frequencyLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-dark-surface/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            <RefreshCw className="shrink-0 text-slate-400" size={14} />
            {t("masterData.teams.rotationNextDate", {
              defaultValue: "Next rotation will be on {{date}}",
              date: formatDayMonthYear(nextRotationDate ?? getNextRotationDate(frequency)),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
