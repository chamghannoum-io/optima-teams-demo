import { cn } from "@/components/enhanced";
import {
  getAvatarColor,
  getClaimsAssigned,
  getInitials,
  getResubmissionsAssigned,
  resolveMemberName,
  type GroupEntry,
  type MemberRow,
} from "./team-performance-helpers";

interface GroupTableRowsProps {
  group: GroupEntry;
  showHeader: boolean;
  compareMode: boolean;
  compareIds: Set<string>;
  onToggleCompare: (id: string) => void;
  onSelectMember: (row: MemberRow) => void;
  showClaimsCol: boolean;
  showAuthsCol: boolean;
  showResubsCol: boolean;
}

export function GroupTableRows({
  group,
  showHeader,
  compareMode,
  compareIds,
  onToggleCompare,
  onSelectMember,
  showClaimsCol,
  showAuthsCol,
  showResubsCol,
}: GroupTableRowsProps) {
  const colSpan =
    (compareMode ? 1 : 0) +
    1 + // member
    (showClaimsCol ? 1 : 0) +
    (showAuthsCol ? 1 : 0) +
    (showResubsCol ? 1 : 0) +
    3; // total, completed, overdue

  return (
    <>
      {showHeader && group.label && (
        <tr>
          <td
            colSpan={colSpan}
            className="bg-slate-50/80 px-3 py-2 dark:bg-dark-surface/80"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {group.label}
            </p>
          </td>
        </tr>
      )}
      {group.members.map((row) => {
        const checked = compareIds.has(row.userId);
        const disabled = !checked && compareIds.size >= 3;
        return (
          <tr
            key={row.userId}
            role="button"
            tabIndex={0}
            onClick={() => onSelectMember(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectMember(row);
            }}
            className={cn(
              "cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-dark-border/40 dark:bg-dark-card dark:hover:bg-slate-800/50",
              row.isOverlimit && "bg-red-50/40 dark:bg-red-950/10"
            )}
          >
            {compareMode && (
              <td className="py-2 pe-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleCompare(row.userId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 dark:border-dark-border"
                />
              </td>
            )}
            <td className="py-2.5 pe-3">
              {(() => {
                const name = resolveMemberName(row);
                return (
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                        getAvatarColor(name)
                      )}
                    >
                      {getInitials(name)}
                    </div>
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-dark-text">
                      {name}
                    </p>
                  </div>
                );
              })()}
            </td>
            {showClaimsCol && (
              <td className="py-2.5 pe-3 text-right text-slate-700 dark:text-slate-300">
                {getClaimsAssigned(row).toLocaleString()}
              </td>
            )}
            {showAuthsCol && (
              <td className="py-2.5 pe-3 text-right text-slate-700 dark:text-slate-300">
                {Number(row.authorizationsAssigned ?? 0).toLocaleString()}
              </td>
            )}
            {showResubsCol &&
              (() => {
                const resubs = getResubmissionsAssigned(row);
                return (
                  <td className="py-2.5 pe-3 text-right text-slate-700 dark:text-slate-300">
                    {resubs == null ? "—" : resubs.toLocaleString()}
                  </td>
                );
              })()}
            <td className="py-2.5 pe-3 text-right font-semibold text-slate-900 dark:text-dark-text">
              {Number(row.totalAssigned ?? 0).toLocaleString()}
            </td>
            <td className="py-2.5 pe-3 text-right text-green-600 dark:text-green-400">
              {Number(row.completed ?? 0).toLocaleString()}
            </td>
            <td className="py-2.5 pe-3 text-right text-red-600 dark:text-red-400">
              {Number(row.overdue ?? 0).toLocaleString()}
            </td>
          </tr>
        );
      })}
    </>
  );
}
