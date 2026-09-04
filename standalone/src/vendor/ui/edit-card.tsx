import type { ReactNode } from "react";
import { Badge } from "./badge.js";
import { Button } from "./button.js";
import {
  getPriorityVariant,
  getPriorityBorder,
  resolveExtraData,
  getAiEditDisplay,
  getDisplayConfidenceColor,
  getEffectivePriority,
} from "./claim-helpers.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface EditCardEdit {
  priority?: string | null;
  category?: string | null;
  subCategory?: string | null;
  code?: string | null;
  message?: string | null;
  details?: string | null;
  actions?: Array<{
    id?: string | null;
    summary?: string | null;
    action?: string | null;
  } | null> | null;
}

export interface EditCardWrapper {
  id?: string | null;
  edit?: EditCardEdit | null;
  extraData?: string | null;
  isAi?: boolean | null;
  note?: string | null;
  likeDislike?: string | null;
  confidenceColor?: string | null;
}

export interface EditCardProps {
  editWrapper: EditCardWrapper | null;
  /** Whether this edit has been resolved */
  isResolved?: boolean;
  /** Summary text shown when resolved */
  resolutionSummary?: string;
  /** Whether the AI guideline evaluation is loading */
  guidelineLoading?: boolean;
  /** Whether the like/dislike mutation is in progress for this edit */
  likeDislikeUpdating?: boolean;
  /** Whether to show the Agree/Disagree buttons */
  showLikeDislike?: boolean;
  /** Whether to show the Resolve button */
  showResolve?: boolean;
  /** Called when AI Recommendations button is clicked */
  onOpenGuideline?: () => void;
  /** Called when Resolve button is clicked */
  onResolve?: () => void;
  /** Called when Undo (unresolve) is clicked */
  onUnresolve?: () => void;
  /** Called when Agree or Disagree is clicked */
  onLikeDislike?: (id: string, value: "LIKE" | "DISLIKE") => void;
  /** Extra action buttons to render between Resolve and Agree/Disagree */
  extraActions?: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────

export function EditCard({
  editWrapper,
  isResolved = false,
  resolutionSummary,
  guidelineLoading = false,
  likeDislikeUpdating = false,
  showLikeDislike = true,
  showResolve = true,
  onOpenGuideline,
  onResolve,
  onUnresolve,
  onLikeDislike,
  extraActions,
}: EditCardProps) {
  const edit = editWrapper?.edit;
  const message = resolveExtraData(edit?.message ?? "-", editWrapper?.extraData);
  const details = resolveExtraData(edit?.details ?? "", editWrapper?.extraData);
  const showDetails = details && details !== message;
  const isLiked = editWrapper?.likeDislike === "LIKE";
  const isDisliked = editWrapper?.likeDislike === "DISLIKE";
  const aiDisplayState = getAiEditDisplay(editWrapper);
  const displayConfidenceColor = getDisplayConfidenceColor(editWrapper);
  // AI confidenceColor (Red/Orange → HIGH, Yellow → MEDIUM) overrides edit.priority.
  const effectivePriority = getEffectivePriority(editWrapper, edit?.priority);

  return (
    <div
      className={`rounded-md border border-l-4 px-4 py-3 ${
        isResolved
          ? "bg-white dark:bg-gray-800 border-green-200 border-l-green-500 dark:border-green-800"
          : `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${getPriorityBorder(effectivePriority)}`
      }`}
    >
      {/* Resolved header + summary */}
      {isResolved && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Resolved
            </span>
            {onUnresolve && (
              <button
                type="button"
                onClick={onUnresolve}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a5 5 0 010 10H9m4-10l-4-4m4 4l-4 4"
                  />
                </svg>
                Undo
              </button>
            )}
          </div>
          {resolutionSummary && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-950/40">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {resolutionSummary}
              </p>
            </div>
          )}
        </>
      )}

      {/* Original card content — muted when resolved */}
      <div className={isResolved ? "opacity-50" : ""}>
        {/* Confidence / Priority badge */}
        <div className="flex items-center gap-2">
          <Badge variant={getPriorityVariant(effectivePriority)} className="px-1.5 py-0 text-[10px]">
            {effectivePriority ?? "UNKNOWN"}
          </Badge>
          {editWrapper?.isAi && (
            <span className="rounded bg-violet-100 px-1.5 py-0 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              AI
            </span>
          )}
          {aiDisplayState === "default" && displayConfidenceColor && (
            <span className="rounded bg-slate-100 px-1.5 py-0 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-500/10 dark:text-slate-400">
              {displayConfidenceColor}
            </span>
          )}
        </div>

        {/* Category / SubCategory / Code breadcrumb */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {edit?.category && (
            <span className="font-semibold text-gray-700 dark:text-gray-300">{edit.category}</span>
          )}
          {edit?.subCategory && (
            <>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {edit.subCategory}
              </span>
            </>
          )}
          {edit?.code && (
            <>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                {edit.code}
              </span>
            </>
          )}
        </div>

        {/* Message */}
        <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">{message}</p>

        {/* Details */}
        {showDetails && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{details}</p>
        )}

        {/* Actions info box (blue) */}
        {edit?.actions && edit.actions.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5 rounded bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              {edit.actions.map((action) => (
                <p key={action?.id} className="text-xs text-blue-700 dark:text-blue-300">
                  {resolveExtraData(
                    action?.summary ?? action?.action ?? "-",
                    editWrapper?.extraData
                  )}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Note (amber) */}
        {editWrapper?.note && (
          <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <strong>Note:</strong> {editWrapper.note}
          </div>
        )}
      </div>

      {/* Action buttons — only when unresolved */}
      {!isResolved && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700">
          {/* AI Recommendations */}
          {onOpenGuideline && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs border-violet-300 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100 dark:border-violet-700 dark:from-violet-950 dark:to-purple-950 dark:text-violet-300 dark:hover:from-violet-900 dark:hover:to-purple-900"
              disabled={guidelineLoading}
              onClick={onOpenGuideline}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
              {guidelineLoading ? "Evaluating..." : "AI Recommendations"}
            </Button>
          )}

          {/* Resolve */}
          {showResolve && onResolve && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 hover:from-emerald-100 hover:to-green-100 dark:border-emerald-700 dark:from-emerald-950 dark:to-green-950 dark:text-emerald-300 dark:hover:from-emerald-900 dark:hover:to-green-900"
              onClick={onResolve}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Resolve
            </Button>
          )}

          {extraActions}

          {/* Agree / Disagree */}
          {showLikeDislike && onLikeDislike && (
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-700">
              <button
                type="button"
                disabled={likeDislikeUpdating}
                onClick={() => onLikeDislike(editWrapper?.id ?? "", "LIKE")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isLiked
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-600"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Agree
              </button>
              <button
                type="button"
                disabled={likeDislikeUpdating}
                onClick={() => onLikeDislike(editWrapper?.id ?? "", "DISLIKE")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isDisliked
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-600"
                }`}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Disagree
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
