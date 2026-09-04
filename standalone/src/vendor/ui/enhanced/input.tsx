import React from "react";
import { cn } from "../utils.js";
import type { LucideIcon } from "lucide-react";
import { Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Skip the label / AI header row — use inside composite fields that provide their own label (e.g. CodeSystemSelect). */
  omitLabelRow?: boolean;
  /** Render a red asterisk next to the label to mark the field as mandatory. */
  required?: boolean;
  error?: string;
  containerClassName?: string;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  trailingIconClassName?: string;
  onTrailingIconClick?: () => void;
  isAIPrefilled?: boolean;
  aiSuggestion?: string;
  aiWarning?: string;
}

const EnhancedInput = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  (
    {
      label,
      omitLabelRow,
      required,
      error,
      className,
      containerClassName,
      leadingIcon: Icon,
      trailingIcon: TrailingIcon,
      trailingIconClassName,
      onTrailingIconClick,
      isAIPrefilled,
      aiSuggestion,
      aiWarning,
      type,
      ...props
    },
    ref
  ) => {
    const widthClass = className?.split(" ").find((c) => c.startsWith("w-")) || "w-full";
    const otherClasses = className
      ?.split(" ")
      .filter((c) => !c.startsWith("w-"))
      .join(" ");

    // Nothing to show in the label row → skip it entirely rather than
    // reserving an empty 14px strip above the control.
    const hasLabelRowContent = Boolean(label || isAIPrefilled || aiSuggestion || aiWarning);

    return (
      <div className={cn("flex flex-col gap-1.5", widthClass, containerClassName)}>
        {!omitLabelRow && hasLabelRowContent && (
          <div className="flex items-center justify-between px-1 min-h-[14px]">
            {label && (
              <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider whitespace-nowrap">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
            )}
            <AnimatePresence>
              {isAIPrefilled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 5 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 5 }}
                  className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20"
                >
                  <Sparkles size={8} className="text-primary animate-pulse" />
                  <span className="text-[8px] font-bold text-primary uppercase tracking-tighter">
                    AI Prefilled
                  </span>
                </motion.div>
              )}
              {!isAIPrefilled && aiSuggestion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20"
                  title={aiSuggestion}
                >
                  <Sparkles size={8} className="text-amber-500 dark:text-amber-400" />
                  <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
                    AI Suggestion
                  </span>
                </motion.div>
              )}
              {aiWarning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-200 dark:border-red-500/20"
                  title={aiWarning}
                >
                  <AlertCircle size={8} className="text-red-500 dark:text-red-400" />
                  <span className="text-[8px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tighter">
                    AI Warning
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div className="relative group w-full">
          {Icon && (
            <Icon
              size={18}
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary z-10 pointer-events-none",
                error && "text-red-400",
                isAIPrefilled && "text-primary"
              )}
            />
          )}
          <input
            ref={ref}
            type={type}
            required={required}
            aria-required={required}
            className={cn(
              "h-[40px] w-full px-4 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg text-xs text-slate-900 dark:text-dark-text transition-all duration-300",
              "placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:text-[11px]",
              "hover:border-slate-300 dark:hover:border-slate-600",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
              "disabled:bg-slate-50 dark:disabled:bg-dark-bg disabled:text-slate-400 disabled:border-slate-100 dark:disabled:border-dark-border disabled:cursor-not-allowed",
              Icon && "pl-10",
              TrailingIcon && "pr-10",
              (error || aiWarning) && "border-red-500 focus:border-red-500 focus:ring-red-500/10",
              aiSuggestion && !isAIPrefilled && "border-amber-300 bg-amber-50/20",
              isAIPrefilled && "border-primary/40 bg-primary/[0.02]",
              otherClasses
            )}
            {...props}
          />
          {TrailingIcon && (
            <button
              type="button"
              onClick={onTrailingIconClick}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-primary z-10",
                onTrailingIconClick ? "cursor-pointer" : "pointer-events-none",
                trailingIconClassName
              )}
            >
              <TrailingIcon size={18} />
            </button>
          )}
        </div>
        {(error || aiWarning) && (
          <span className="text-[10px] font-medium text-red-500 px-1">{error || aiWarning}</span>
        )}
      </div>
    );
  }
);

EnhancedInput.displayName = "EnhancedInput";

export { EnhancedInput };
