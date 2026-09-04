import type { ReactNode } from "react";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "./utils.js";
import { motion } from "motion/react";

/**
 * Stepper — Cortex Design System (SKILL 5.36)
 *
 * Vertical variant:
 *   Button: flex items-start gap-5 px-8 py-6 border-b
 *   Active: bg-primary/[0.03] + left bar (w-1 bg-primary, layoutId spring)
 *   Label: text-sm font-bold, Description: text-[11px] font-medium
 *
 * Step states:
 *   active:    bg-primary text-white scale-105 (indicator)
 *   completed: bg-emerald-500 text-white + Check icon (spring)
 *   upcoming:  bg-slate-100 dark:bg-dark-elevated text-slate-400
 *   error:     bg-red-500 text-white + AlertCircle icon
 */

export interface StepItem<T extends string = string> {
  id: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export type StepStatus = "completed" | "active" | "upcoming" | "error";

export interface StepperProps<T extends string = string> {
  steps: StepItem<T>[];
  activeId: T;
  completedIds?: Set<T>;
  errorIds?: Set<T>;
  onChange?: (id: T) => void;
  gated?: boolean;
  compact?: boolean;
  className?: string;
}

function getStatus<T extends string>(
  stepId: T,
  activeId: T,
  steps: StepItem<T>[],
  completedIds?: Set<T>,
  errorIds?: Set<T>
): StepStatus {
  // Error status takes precedence
  if (errorIds?.has(stepId)) return "error";

  if (completedIds) {
    if (completedIds.has(stepId)) return "completed";
    if (stepId === activeId) return "active";
    return "upcoming";
  }
  const activeIdx = steps.findIndex((s) => s.id === activeId);
  const stepIdx = steps.findIndex((s) => s.id === stepId);
  if (stepIdx < activeIdx) return "completed";
  if (stepIdx === activeIdx) return "active";
  return "upcoming";
}

function StepIndicator({ index, status }: { index: number; status: StepStatus }) {
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 font-bold text-xs",
        status === "active" && "bg-[#2D3670] text-white scale-105",
        status === "completed" && "bg-emerald-500 text-white",
        status === "error" && "bg-red-500 text-white",
        status === "upcoming" && "bg-slate-100 dark:bg-[#1A2234] text-slate-400 dark:text-[#64748B]"
      )}
    >
      {status === "completed" ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <Check size={16} strokeWidth={3} />
        </motion.div>
      ) : status === "error" ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <AlertCircle size={16} strokeWidth={3} />
        </motion.div>
      ) : (
        <span>{String(index + 1).padStart(2, "0")}</span>
      )}
    </div>
  );
}

export function Stepper<T extends string>({
  steps,
  activeId,
  completedIds,
  errorIds,
  onChange,
  gated = false,
  compact = false,
  className,
}: StepperProps<T>) {
  return (
    <div className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const status = getStatus(step.id, activeId, steps, completedIds, errorIds);
        const clickable =
          !!onChange && (gated ? status === "completed" || status === "active" : true);

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => clickable && onChange?.(step.id)}
            disabled={!clickable}
            className={cn(
              "relative flex items-start gap-5 px-8 py-6 transition-all border-b border-slate-200 dark:border-[#2A3141] text-left group",
              status === "active"
                ? "bg-[#2D3670]/[0.03] dark:bg-[#2D3670]/[0.08]"
                : status === "error"
                  ? "bg-red-50/30 dark:bg-red-500/5"
                  : "bg-white dark:bg-[#111827]",
              clickable && status !== "active" && "hover:bg-slate-50/50 dark:hover:bg-[#1C2535]/50",
              !clickable && "cursor-not-allowed"
            )}
          >
            {/* Active indicator bar */}
            {status === "active" && (
              <motion.div
                layoutId="stepper-active-bar"
                className="absolute left-0 top-0 bottom-0 w-1 bg-[#2D3670] dark:bg-[#a5b1db] shadow-[0_0_10px_rgba(45,54,112,0.3)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            <StepIndicator index={index} status={status} />

            <div className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "text-sm font-bold transition-colors duration-300 leading-tight tracking-tight",
                  status === "active" && "text-[#2D3670] dark:text-[#a5b1db]",
                  status === "completed" && "text-slate-900 dark:text-[#E2E8F0]",
                  status === "error" && "text-red-600 dark:text-red-400",
                  status === "upcoming" && "text-slate-400 dark:text-[#64748B]"
                )}
              >
                {step.label}
              </span>
              {!compact && step.description && (
                <span
                  className={cn(
                    "text-[11px] font-medium leading-relaxed transition-colors duration-300",
                    status === "active"
                      ? "text-slate-600 dark:text-[#94A3B8]"
                      : status === "error"
                        ? "text-red-500 dark:text-red-400"
                        : "text-slate-400 dark:text-[#64748B]"
                  )}
                >
                  {step.description}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
