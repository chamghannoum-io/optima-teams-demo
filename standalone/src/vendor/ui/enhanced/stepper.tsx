import React from "react";
import { Check } from "lucide-react";
import { cn } from "../utils.js";
import { motion } from "motion/react";

export interface StepItem<T extends string = string> {
  id: T;
  label: string;
  description?: string;
}

export type StepStatus = "completed" | "active" | "upcoming";

export interface StepperProps<T extends string = string> {
  steps: StepItem<T>[];
  activeId: T;
  completedIds?: Set<T>;
  clickableIds?: Set<T>;
  onChange?: React.Dispatch<React.SetStateAction<T>>;
  gated?: boolean;
  variant?: "vertical" | "horizontal";
  compact?: boolean;
  className?: string;
}

function getStatus<T extends string>(
  stepId: T,
  activeId: T,
  steps: StepItem<T>[],
  completedIds?: Set<T>
): StepStatus {
  if (completedIds) {
    if (stepId === activeId) return "active";
    if (completedIds.has(stepId)) return "completed";
    return "upcoming";
  }
  const activeIdx = steps.findIndex((s) => s.id === activeId);
  const stepIdx = steps.findIndex((s) => s.id === stepId);
  if (stepIdx < activeIdx) return "completed";
  if (stepIdx === activeIdx) return "active";
  return "upcoming";
}

const StepIndicator: React.FC<{ index: number; status: StepStatus }> = ({ index, status }) => (
  <div
    className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 font-bold text-xs",
      status === "active" && "bg-primary text-white scale-105",
      status === "completed" && "bg-emerald-500 text-white",
      status === "upcoming" &&
        "bg-slate-100 dark:bg-dark-elevated text-slate-400 dark:text-slate-500"
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
    ) : (
      <span>{String(index + 1).padStart(2, "0")}</span>
    )}
  </div>
);

export function EnhancedStepper<T extends string>({
  steps,
  activeId,
  completedIds,
  clickableIds,
  onChange,
  gated = false,
  variant = "vertical",
  compact = false,
  className,
}: StepperProps<T>) {
  const isClickable = (stepId: T, status: StepStatus): boolean => {
    if (!onChange) return false;
    if (!gated) return true;
    if (status === "completed" || status === "active") return true;
    return clickableIds?.has(stepId) ?? false;
  };

  if (variant === "horizontal") {
    return (
      <div className={cn("flex items-start", className)}>
        {steps.map((step, index) => {
          const status = getStatus(step.id, activeId, steps, completedIds);
          const clickable = isClickable(step.id, status);
          const isLast = index === steps.length - 1;
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => clickable && onChange?.(step.id)}
                disabled={!clickable}
                className={cn(
                  "flex flex-col items-center gap-2 transition-all",
                  clickable ? "cursor-pointer hover:scale-105" : "cursor-not-allowed"
                )}
              >
                <StepIndicator index={index} status={status} />
                <span
                  className={cn(
                    "text-[10px] font-bold transition-colors text-center",
                    status === "active" && "text-primary dark:text-primary-300",
                    status === "completed" && "text-slate-700 dark:text-slate-300",
                    status === "upcoming" && "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {step.label}
                </span>
              </button>
              {!isLast && (
                <div className="relative h-0.5 flex-1 mt-5 mx-3">
                  <div className="absolute inset-0 bg-slate-200 dark:bg-dark-border rounded-full" />
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-emerald-400 dark:bg-emerald-500 rounded-full"
                    initial={false}
                    animate={{ width: status === "completed" ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const status = getStatus(step.id, activeId, steps, completedIds);
        const clickable = isClickable(step.id, status);
        return (
          <button
            type="button"
            key={step.id}
            onClick={() => clickable && onChange?.(step.id)}
            disabled={!clickable}
            className={cn(
              "relative flex items-start gap-5 px-8 py-6 transition-all border-b border-slate-200 dark:border-dark-border text-left group",
              status === "active" ? "bg-primary/[0.03]" : "bg-white dark:bg-dark-surface",
              clickable &&
                status !== "active" &&
                "hover:bg-slate-50/50 dark:hover:bg-dark-hover/50",
              !clickable && "cursor-not-allowed"
            )}
          >
            {status === "active" && (
              <motion.div
                layoutId="stepper-active-bar"
                className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <StepIndicator index={index} status={status} />
            <div className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "text-sm font-bold transition-colors duration-300 leading-tight tracking-tight",
                  status === "active" && "text-primary dark:text-primary-300",
                  status === "completed" && "text-slate-900 dark:text-dark-text",
                  status === "upcoming" && "text-slate-400 dark:text-slate-500"
                )}
              >
                {step.label}
              </span>
              {!compact && step.description && (
                <span
                  className={cn(
                    "text-[11px] font-medium leading-relaxed transition-colors duration-300",
                    status === "active"
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-400 dark:text-slate-500"
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
