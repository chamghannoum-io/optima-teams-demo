import React, { memo, useState, useMemo, useRef, useCallback } from "react";
import { X, User, UserMinus, CheckCircle, ArrowUp, Users, Search } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Modal } from "@/components/enhanced";
import type { ReassignmentReason } from "@/__generated__/graphql";

type ReassignmentReasonValue =
  | "REQUIRES_REVIEW"
  | "REQUIRES_REWORK"
  | "INCORRECT_ASSIGNMENT"
  | "URGENT_TURNAROUND"
  | "CODER_CAPACITY_IS_REACHED"
  | "CODER_ON_LEAVE_UNAVAILABLE"
  | "OTHER";

interface SelectionDockProps {
  selectedCount: number;
  onClearSelection: () => void;
  /** Label shown next to the count, e.g. "Claim" / "Request". Pluralised automatically. */
  itemLabel?: string;
  onSelfAssign?: () => void;
  onUnassign?: () => void;
  onChangeStatus?: () => void;
  onChangePriority?: () => void;
  onAssign?: (
    userId: string,
    options?: { reassignmentReason?: ReassignmentReason; notes?: string }
  ) => void;
  users?: Array<{ id: string; name: string }>;
  currentUserId?: string;
  /** Whether the user has supervisor-level permissions (ManageAssignments). */
  canManageAssignments?: boolean;
  /** Whether coder-level bulk reassign should be available for current selection. */
  canCoderReassign?: boolean;
  /** When true, require reason/notes flow before confirming reassign. */
  requiresReassignmentReason?: boolean;
  /** Whether any of the selected items have an assignee. Controls unassign visibility. */
  hasAssignedItems?: boolean;
  isProcessing?: boolean;
  // ── Submission readiness actions ────────────────────────────────────────────
  /** Number of selected rows that are NOT yet marked ready (eligible to mark). */
  markableCount?: number;
  /** Number of selected rows that ARE currently marked ready (eligible to unmark or submit). */
  markedCount?: number;
  onMarkReady?: () => void;
  onUnmarkReady?: () => void;
  onSubmitMarked?: () => void;
  /** Whether the current user has permission to submit. Hides submit-related buttons when false. */
  canSubmit?: boolean;
  /** Independent processing flag for submission mutations (mark/unmark/submit). */
  isSubmissionProcessing?: boolean;
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-amber-500",
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  const first = parts[0][0];
  if (parts.length === 1) return first?.toUpperCase() ?? "?";
  const last = parts[parts.length - 1]?.[0];
  return `${first ?? ""}${last ?? ""}`.toUpperCase();
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export const SelectionDock = memo(function SelectionDock({
  selectedCount,
  onClearSelection,
  itemLabel = "Claim",
  onSelfAssign,
  onUnassign,
  onChangeStatus,
  onChangePriority,
  onAssign,
  users = [],
  currentUserId,
  canManageAssignments = false,
  canCoderReassign = false,
  requiresReassignmentReason = false,
  hasAssignedItems = false,
  isProcessing = false,
}: SelectionDockProps) {
  const idCandidates = useCallback((id: string | null | undefined) => {
    const raw = (id ?? "").trim();
    if (!raw) return [];
    const candidates = new Set<string>();
    const normalize = (value: string) => value.trim().replace(/-/g, "").toLowerCase();
    const pushCandidate = (value: string | null | undefined) => {
      const normalized = normalize(value ?? "");
      if (normalized) candidates.add(normalized);
      const suffix = (value ?? "").split(":").pop();
      const normalizedSuffix = normalize(suffix ?? "");
      if (normalizedSuffix) candidates.add(normalizedSuffix);
    };
    pushCandidate(raw);
    if (typeof globalThis.atob === "function") {
      try {
        pushCandidate(globalThis.atob(raw));
      } catch {
        // Not a base64 global id; ignore.
      }
    }
    return Array.from(candidates);
  }, []);

  const idsMatch = useCallback(
    (left: string | null | undefined, right: string | null | undefined) => {
      const leftCandidates = new Set(idCandidates(left));
      return idCandidates(right).some((candidate) => leftCandidates.has(candidate));
    },
    [idCandidates]
  );

  const [assignOpen, setAssignOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [pendingAssigneeId, setPendingAssigneeId] = useState<string | null>(null);
  const [reassignmentReason, setReassignmentReason] = useState<ReassignmentReasonValue | "">("");
  const [reassignmentNotes, setReassignmentNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      if (idsMatch(a.id, currentUserId)) return -1;
      if (idsMatch(b.id, currentUserId)) return 1;
      return 0;
    });
    if (!search) return sorted;
    const term = search.toLowerCase();
    return sorted.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        (idsMatch(u.id, currentUserId) && "me".includes(term))
    );
  }, [users, search, currentUserId, idsMatch]);

  const handleAssignOpenChange = useCallback((v: boolean) => {
    setAssignOpen(v);
    if (!v) setSearch("");
  }, []);

  const handleAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    inputRef.current?.focus();
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const isOtherReason = reassignmentReason === "OTHER";
  const canConfirmReassign =
    !!pendingAssigneeId &&
    !!reassignmentReason &&
    (!isOtherReason || reassignmentNotes.trim().length > 0);

  const openReassignDialog = useCallback((userId: string) => {
    setPendingAssigneeId(userId);
    setReassignmentReason("");
    setReassignmentNotes("");
    setReassignDialogOpen(true);
  }, []);

  const closeReassignDialog = useCallback(() => {
    setReassignDialogOpen(false);
    setPendingAssigneeId(null);
    setReassignmentReason("");
    setReassignmentNotes("");
  }, []);

  const confirmReassign = useCallback(() => {
    if (!pendingAssigneeId || !reassignmentReason) return;
    onAssign?.(pendingAssigneeId, {
      reassignmentReason: reassignmentReason as ReassignmentReason,
      notes: reassignmentNotes.trim(),
    });
    closeReassignDialog();
  }, [pendingAssigneeId, reassignmentReason, reassignmentNotes, onAssign, closeReassignDialog]);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3 rounded-full bg-primary px-6 py-3 shadow-2xl border border-primary-600">
        {/* Selection Count */}
        <div className="flex items-center gap-3 pr-3 border-r border-primary-300/30">
          <span className="text-sm font-semibold text-white">
            {selectedCount} {selectedCount === 1 ? itemLabel : `${itemLabel}s`} selected
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="flex items-center justify-center h-5 w-5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Clear selection"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Self Assign */}
          {onSelfAssign && (
            <button
              type="button"
              onClick={onSelfAssign}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-300/25 hover:bg-primary-300/40 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary-300/20"
            >
              <User size={16} />
              Assign to me
            </button>
          )}

          {/* Unassign — only show when some selected items have an assignee */}
          {onUnassign && hasAssignedItems && (
            <button
              type="button"
              onClick={onUnassign}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-400/25 hover:bg-red-400/40 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-400/20"
            >
              <UserMinus size={16} />
              Unassign
            </button>
          )}

          {/* Change Status */}
          {onChangeStatus && (
            <button
              type="button"
              onClick={onChangeStatus}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-300/25 hover:bg-primary-300/40 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary-300/20"
            >
              <CheckCircle size={16} />
              Status
            </button>
          )}

          {/* Change Priority */}
          {onChangePriority && (
            <button
              type="button"
              onClick={onChangePriority}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-300/25 hover:bg-primary-300/40 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary-300/20"
            >
              <ArrowUp size={16} />
              Priority
            </button>
          )}

          {/* Reassign with popover — supervisors and eligible coder selections */}
          {(canManageAssignments || canCoderReassign) && (
            <PopoverPrimitive.Root open={assignOpen} onOpenChange={handleAssignOpenChange}>
              <PopoverPrimitive.Trigger asChild>
                <button
                  type="button"
                  disabled={isProcessing || !onAssign}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-300/25 hover:bg-primary-300/40 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary-300/20"
                >
                  <Users size={16} />
                  {requiresReassignmentReason ? "Reassign" : "Assign"}
                </button>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                  className="z-[60] w-64 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                  align="start"
                  side="top"
                  sideOffset={8}
                  onOpenAutoFocus={handleAutoFocus}
                >
                  {/* Search */}
                  <div className="flex items-center border-b border-slate-200 dark:border-dark-border px-3">
                    <Search size={16} className="me-2 shrink-0 text-slate-400" />
                    <input
                      ref={inputRef}
                      value={search}
                      onChange={handleSearchChange}
                      placeholder="Search..."
                      className="flex h-9 w-full bg-transparent py-2 text-sm text-slate-900 dark:text-dark-text outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      People
                    </div>
                    {filteredUsers.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                        No users found
                      </div>
                    )}
                    {filteredUsers.map((user) => {
                      const isMe = idsMatch(user.id, currentUserId);
                      const initials = getInitials(user.name);
                      const color = getAvatarColor(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            if (requiresReassignmentReason) {
                              openReassignDialog(user.id);
                            } else {
                              onAssign?.(user.id);
                            }
                            setAssignOpen(false);
                            setSearch("");
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors"
                        >
                          {isMe ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-slate-600 dark:text-slate-300">
                              <User size={14} />
                            </span>
                          ) : (
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${color}`}
                            >
                              {initials}
                            </span>
                          )}
                          <span className="flex-1 truncate text-left text-slate-700 dark:text-slate-200">
                            {isMe ? "Me" : user.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          )}
        </div>
      </div>
      <Modal
        isOpen={reassignDialogOpen}
        onClose={closeReassignDialog}
        title="Reassign Work Items"
        subtitle={`Selected ${selectedCount} ${selectedCount === 1 ? itemLabel : `${itemLabel}s`}`}
        size="sm"
        contentWrapperClassName="!z-[130]"
        overlayClassName="!z-[125] !bg-black/50 !backdrop-blur-md"
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={closeReassignDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={!canConfirmReassign}
              onClick={confirmReassign}
            >
              Confirm Reassign
            </button>
          </>
        }
      >
        <div className="px-8 py-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reassignment Reason
            </label>
            <select
              value={reassignmentReason}
              onChange={(e) =>
                setReassignmentReason(e.target.value as ReassignmentReasonValue | "")
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Select reason</option>
              <option value="REQUIRES_REVIEW">Requires review</option>
              <option value="REQUIRES_REWORK">Requires rework</option>
              <option value="INCORRECT_ASSIGNMENT">Incorrect assignment</option>
              <option value="URGENT_TURNAROUND">Urgent turnaround</option>
              <option value="CODER_CAPACITY_IS_REACHED">Coder capacity reached</option>
              <option value="CODER_ON_LEAVE_UNAVAILABLE">Coder unavailable / on leave</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notes {isOtherReason ? "(required)" : "(optional)"}
            </label>
            <textarea
              value={reassignmentNotes}
              onChange={(e) => setReassignmentNotes(e.target.value)}
              rows={3}
              placeholder={
                isOtherReason ? "Please provide additional context." : "Add optional context."
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
});
