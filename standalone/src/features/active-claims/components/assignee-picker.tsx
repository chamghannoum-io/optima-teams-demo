import React, { useState, useMemo, useRef, useCallback } from "react";
import { Users, Plus, Search, User, X, Check } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Tooltip, TooltipTrigger, TooltipContent, Modal } from "@/components/enhanced";
import { motion } from "motion/react";
import type { ReassignmentReason } from "@/__generated__/graphql";

type ReassignmentReasonValue =
  | "REQUIRES_REVIEW"
  | "REQUIRES_REWORK"
  | "INCORRECT_ASSIGNMENT"
  | "URGENT_TURNAROUND"
  | "CODER_CAPACITY_IS_REACHED"
  | "CODER_ON_LEAVE_UNAVAILABLE"
  | "OTHER";

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

interface AssigneePickerProps {
  currentAssigneeId?: string | null;
  currentAssigneeName?: string | null;
  users: Array<{ id: string; name: string }>;
  currentUserId?: string;
  onAssign: (
    userId: string,
    options?: { reassignmentReason?: ReassignmentReason; notes?: string }
  ) => void;
  onSelfAssign: () => void;
  onUnassign?: () => void;
  canUnassign?: boolean;
  /** Whether the user has supervisor-level assignment permissions (ManageAssignments). */
  canManageAssignments?: boolean;
  /** Whether coder-level reassign should be available (own assignments only). */
  canCoderReassign?: boolean;
  /** Whether managers can reassign already assigned work items. */
  canManageReassign?: boolean;
  /** Whether self-assign should be available for the current work item. */
  canSelfAssign?: boolean;
  disabled?: boolean;
  /** "avatar" (default) shows the circle icon; "button" shows a labelled button. */
  variant?: "avatar" | "button";
}

export function AssigneePicker({
  currentAssigneeId,
  currentAssigneeName,
  users,
  currentUserId,
  onAssign,
  onSelfAssign,
  onUnassign,
  canUnassign,
  canManageAssignments = false,
  canCoderReassign = false,
  canManageReassign = true,
  canSelfAssign = true,
  disabled,
  variant = "avatar",
}: AssigneePickerProps) {
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
    // Only attempt base64 decoding for inputs that actually look like
    // Relay-style global ids — length is a multiple of 4 (with the usual
    // base64 alphabet) and the decoded result contains a `:` separator.
    // Decoding short numeric ids like "854" / "856" produces colliding byte
    // strings because the trailing bits get discarded, which causes a false
    // match in `idsMatch` and surfaces unrelated users as "Me".
    const looksLikeBase64Id =
      raw.length >= 8 && raw.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(raw);
    if (looksLikeBase64Id && typeof globalThis.atob === "function") {
      try {
        const decoded = globalThis.atob(raw);
        if (decoded.includes(":")) pushCandidate(decoded);
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [pendingAssigneeId, setPendingAssigneeId] = useState<string | null>(null);
  const [reassignmentReason, setReassignmentReason] = useState<ReassignmentReasonValue | "">("");
  const [reassignmentNotes, setReassignmentNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isAssigned = !!currentAssigneeId;
  const initials = currentAssigneeName ? getInitials(currentAssigneeName) : "";
  const avatarColor = currentAssigneeId ? getAvatarColor(currentAssigneeId) : "";

  const isAssignedToMe = !!currentAssigneeId && idsMatch(currentAssigneeId, currentUserId);
  const displayedAssigneeName = isAssignedToMe ? "Me" : (currentAssigneeName ?? "Assigned");
  const managerCanShowPeopleList = canManageAssignments && (!isAssigned || canManageReassign);
  const canDirectSelfAssign = !canManageAssignments && !isAssigned && canSelfAssign;
  const canShowPeopleList = managerCanShowPeopleList || canCoderReassign;
  const canShowUnassignAction = !!currentAssigneeId && !!canUnassign && !!onUnassign;
  const canShowPickerActions = canShowPeopleList || canShowUnassignAction;
  const hasAssignedActions = canShowPeopleList || !!canUnassign;
  const interactionDisabled = !!disabled || (isAssigned && !hasAssignedActions && !isAssignedToMe);
  const isRcmWithoutManagerPermissions = !canManageAssignments;
  const peopleActionLabel = isAssigned ? "Reassign to" : "Assign to";
  const popoverTitle = isRcmWithoutManagerPermissions && isAssigned ? "Reassign" : "Assign To";

  // Only RCM supervisors can assign/reassign to other users.
  // Non-supervisors can only self-assign/take-over.
  const visibleUsers = useMemo(() => {
    if (canManageAssignments || canCoderReassign) {
      // Supervisors can also assign a claim to themselves, but they're often
      // not part of the RCM `users` list (they're managers, not coders). We
      // don't surface a separate "Assign to me" button for them — instead we
      // inject a "Me" entry (rendered as "Me" via `idsMatch`) at the top of
      // the picker so they can self-assign from the same list.
      if (
        canManageAssignments &&
        currentUserId &&
        !users.some((u) => idsMatch(u.id, currentUserId))
      ) {
        return [{ id: currentUserId, name: "Me" }, ...users];
      }
      return users;
    }
    // Non-supervisor without coder reassign: only allow self-assign
    return users.filter((u) => idsMatch(u.id, currentUserId) && canSelfAssign);
  }, [users, canManageAssignments, canCoderReassign, currentUserId, idsMatch, canSelfAssign]);

  const filteredUsers = useMemo(() => {
    const sorted = [...visibleUsers].sort((a, b) => {
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
  }, [visibleUsers, search, currentUserId, idsMatch]);

  // Separate the current assignee from the rest
  const currentAssignee = useMemo(() => {
    if (!currentAssigneeId) return null;
    return users.find((u) => idsMatch(u.id, currentAssigneeId)) ?? null;
  }, [users, currentAssigneeId, idsMatch]);
  const currentAssigneeDisplayName = isAssignedToMe
    ? "Me"
    : (currentAssigneeName ?? currentAssignee?.name ?? "Assigned user");

  const isOtherReason = reassignmentReason === "OTHER";
  const canConfirmReassign =
    !!pendingAssigneeId &&
    !!reassignmentReason &&
    (!isOtherReason || reassignmentNotes.trim().length > 0);

  const openReassignDialog = (userId: string) => {
    setPendingAssigneeId(userId);
    setReassignmentReason("");
    setReassignmentNotes("");
    setReassignDialogOpen(true);
  };

  const closeReassignDialog = () => {
    setReassignDialogOpen(false);
    setPendingAssigneeId(null);
    setReassignmentReason("");
    setReassignmentNotes("");
  };

  const confirmReassign = () => {
    if (!pendingAssigneeId || !reassignmentReason) return;
    onAssign(pendingAssigneeId, {
      reassignmentReason: reassignmentReason as ReassignmentReason,
      notes: reassignmentNotes.trim(),
    });
    closeReassignDialog();
  };

  const handleSelect = (userId: string) => {
    if (isAssigned && idsMatch(userId, currentAssigneeId)) {
      setOpen(false);
      setSearch("");
      return;
    }

    if (isAssigned) {
      setOpen(false);
      setSearch("");
      openReassignDialog(userId);
      return;
    }

    // Supervisors should always use assign/reassign, even when selecting themselves.
    if (!canManageAssignments && idsMatch(userId, currentUserId)) {
      if (!canSelfAssign) {
        setOpen(false);
        setSearch("");
        return;
      }
      onSelfAssign();
    } else {
      onAssign(userId);
    }
    setOpen(false);
    setSearch("");
  };

  if (canDirectSelfAssign) {
    return (
      <button
        type="button"
        disabled={interactionDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onSelfAssign();
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3 h-[40px] hover:bg-slate-50 dark:hover:bg-dark-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 dark:border-dark-border text-slate-400 dark:text-slate-500">
          <Plus size={12} />
        </span>
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          Assign to me
        </span>
      </button>
    );
  }

  // No actionable permission for this row/work item.
  // If the row is assigned, surface the assignee in a read-only avatar so RCM
  // users can see who is working on it; only hide the control when the row is
  // unassigned and no actions are available.
  if (!canShowPickerActions) {
    if (!isAssigned) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {variant === "button" ? (
            <span className="inline-flex h-[40px] cursor-default items-center gap-1.5 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAssignedToMe ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[8px] font-bold text-slate-600 dark:text-slate-300">
                  Me
                </span>
              ) : (
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor}`}
                >
                  {initials}
                </span>
              )}
              {displayedAssigneeName}
            </span>
          ) : isAssignedToMe ? (
            <span className="inline-flex h-6 w-6 cursor-default items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[9px] font-bold text-slate-600 dark:text-slate-300">
              Me
            </span>
          ) : (
            <span
              className={`inline-flex h-6 w-6 cursor-default items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor}`}
            >
              {initials}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>{displayedAssigneeName}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(v: boolean) => {
          if (!disabled) {
            setOpen(v);
            if (!v) setSearch("");
          }
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverPrimitive.Trigger asChild>
              {variant === "button" ? (
                <button
                  type="button"
                  disabled={interactionDisabled}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAssigned ? (
                    isAssignedToMe ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[8px] font-bold text-slate-600 dark:text-slate-300">
                        Me
                      </span>
                    ) : (
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor}`}
                      >
                        {initials}
                      </span>
                    )
                  ) : (
                    <Users size={14} className="text-slate-500 dark:text-slate-400" />
                  )}
                  {isAssigned ? displayedAssigneeName : "Assign"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={interactionDisabled}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center rounded-full hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAssigned ? (
                    isAssignedToMe ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[9px] font-bold text-slate-600 dark:text-slate-300 transition-all">
                        Me
                      </span>
                    ) : (
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarColor} transition-all`}
                      >
                        {initials}
                      </span>
                    )
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 dark:border-dark-border text-slate-400 dark:text-slate-500 transition-all">
                      <Plus size={12} />
                    </span>
                  )}
                </button>
              )}
            </PopoverPrimitive.Trigger>
          </TooltipTrigger>
          <TooltipContent>{isAssigned ? displayedAssigneeName : "Assign user"}</TooltipContent>
        </Tooltip>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className="z-[90] w-72 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            align="end"
            sideOffset={6}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            onOpenAutoFocus={(e: Event) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            {/* Header */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider">
                {popoverTitle}
              </p>
            </div>

            {/* Search input */}
            <div className="flex items-center border-b border-slate-100 dark:border-dark-border/50 mx-3 mb-1">
              <Search size={14} className="me-2 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="flex h-8 w-full bg-transparent py-2 text-xs text-slate-900 dark:text-dark-text outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="max-h-[280px] overflow-y-auto py-1">
              {/* Current Assignee section */}
              {currentAssignee && !search && (
                <div>
                  <div className="px-4 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Current
                  </div>
                  {canUnassign && onUnassign ? (
                    <button
                      type="button"
                      onClick={() => {
                        onUnassign();
                        setOpen(false);
                      }}
                      className="group/unassign flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {idsMatch(currentAssignee.id, currentUserId) ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[9px] font-bold text-slate-600 dark:text-slate-300 group-hover/unassign:bg-red-100 group-hover/unassign:text-red-500 dark:group-hover/unassign:bg-red-900/40 dark:group-hover/unassign:text-red-400 transition-colors">
                          <span className="group-hover/unassign:hidden">Me</span>
                          <X size={12} className="hidden group-hover/unassign:block" />
                        </span>
                      ) : (
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${getAvatarColor(currentAssignee.id)} group-hover/unassign:bg-red-500 transition-colors`}
                        >
                          <span className="group-hover/unassign:hidden">
                            {getInitials(currentAssignee.name)}
                          </span>
                          <X size={12} className="hidden group-hover/unassign:block" />
                        </span>
                      )}
                      <span className="flex-1 truncate text-left text-slate-700 dark:text-slate-200 group-hover/unassign:text-red-600 dark:group-hover/unassign:text-red-400 transition-colors">
                        {idsMatch(currentAssignee.id, currentUserId) ? "Me" : currentAssignee.name}
                      </span>
                      <span className="text-[10px] font-medium text-transparent group-hover/unassign:text-red-500 transition-colors">
                        Unassign
                      </span>
                    </button>
                  ) : (
                    <UserRow
                      user={currentAssignee}
                      isSelected={true}
                      isMe={idsMatch(currentAssignee.id, currentUserId)}
                      onClick={() => handleSelect(currentAssignee.id)}
                      actionLabel={peopleActionLabel}
                    />
                  )}
                </div>
              )}

              {/* Fallback when assignee is not in loaded users list */}
              {!currentAssignee && currentAssigneeId && canUnassign && onUnassign && !search && (
                <div>
                  <div className="px-4 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Current
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUnassign();
                      setOpen(false);
                    }}
                    className="group/unassign flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[9px] font-bold text-slate-600 dark:text-slate-300 group-hover/unassign:bg-red-100 group-hover/unassign:text-red-500 dark:group-hover/unassign:bg-red-900/40 dark:group-hover/unassign:text-red-400 transition-colors">
                      {isAssignedToMe ? (
                        <span className="group-hover/unassign:hidden">Me</span>
                      ) : (
                        <User size={14} className="group-hover/unassign:hidden" />
                      )}
                      <X size={12} className="hidden group-hover/unassign:block" />
                    </span>
                    <span className="flex-1 truncate text-left text-slate-700 dark:text-slate-200 group-hover/unassign:text-red-600 dark:group-hover/unassign:text-red-400 transition-colors">
                      {currentAssigneeDisplayName}
                    </span>
                    <span className="text-[10px] font-medium text-transparent group-hover/unassign:text-red-500 transition-colors">
                      Unassign
                    </span>
                  </button>
                </div>
              )}

              {/* People section — supervisors only (reassign disabled for regular RCM users) */}
              {canShowPeopleList && (
                <div>
                  <div className="px-4 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    People
                  </div>
                  {filteredUsers.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                      No users found
                    </div>
                  )}
                  {filteredUsers
                    .filter((user) => !currentAssignee || !idsMatch(user.id, currentAssigneeId))
                    .map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isSelected={idsMatch(user.id, currentAssigneeId)}
                        isMe={idsMatch(user.id, currentUserId)}
                        onClick={() => handleSelect(user.id)}
                        actionLabel={peopleActionLabel}
                      />
                    ))}
                </div>
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <Modal
        isOpen={reassignDialogOpen}
        onClose={closeReassignDialog}
        title="Reassign Work Item"
        subtitle="Select reason before confirming reassignment"
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
    </>
  );
}

function UserRow({
  user,
  isSelected,
  isMe,
  onClick,
  actionLabel,
}: {
  user: { id: string; name: string };
  isSelected: boolean;
  isMe: boolean;
  onClick: () => void;
  actionLabel?: string;
}) {
  const initials = getInitials(user.name);
  const color = getAvatarColor(user.id);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className={`group flex w-full items-center gap-2.5 px-4 py-2 text-xs rounded-lg mx-1 my-0.5 transition-colors ${
        isSelected
          ? "bg-primary/5 dark:bg-primary/10"
          : "hover:bg-slate-50 dark:hover:bg-dark-hover"
      }`}
      style={{ width: "calc(100% - 8px)" }}
    >
      {isMe ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-dark-elevated text-[9px] font-bold text-slate-600 dark:text-slate-300">
          Me
        </span>
      ) : (
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${color}`}
        >
          {initials}
        </span>
      )}
      <div className="flex-1 min-w-0 text-left">
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate block">
          {isMe ? "Me" : user.name}
        </span>
        {isMe && (
          <span className="text-[9px] text-slate-400 dark:text-slate-500">Assign to me</span>
        )}
      </div>
      {!isSelected && actionLabel && (
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
          {actionLabel}
        </span>
      )}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Check size={14} className="shrink-0 text-primary dark:text-primary-300" />
        </motion.div>
      )}
    </motion.button>
  );
}
