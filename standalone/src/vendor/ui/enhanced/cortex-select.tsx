import React from "react";
import { cn } from "../utils.js";
import { ChevronDown, Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface CortexSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  options?: { value: string; label: string }[];
  isAIPrefilled?: boolean;
  aiSuggestion?: string;
  aiWarning?: string;
}

const CortexSelect = React.forwardRef<HTMLSelectElement, CortexSelectProps>(
  (
    {
      label,
      error,
      className,
      containerClassName,
      options,
      children,
      isAIPrefilled,
      aiSuggestion,
      aiWarning,
      ...props
    },
    ref
  ) => {
    const widthClass = className?.split(" ").find((c) => c.startsWith("w-")) || "w-full";
    const otherClasses = className
      ?.split(" ")
      .filter((c) => !c.startsWith("w-"))
      .join(" ");

    return (
      <div className={cn("flex flex-col gap-1.5", widthClass, containerClassName)}>
        <div className="flex items-center justify-between px-1">
          {label && (
            <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider whitespace-nowrap">
              {label}
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
        <div className="relative group w-full">
          <select
            ref={ref}
            className={cn(
              "h-[40px] w-full pl-4 pr-10 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg text-xs text-slate-900 dark:text-dark-text appearance-none transition-all duration-300",
              "hover:border-slate-300 dark:hover:border-slate-600",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
              "disabled:bg-slate-50 dark:disabled:bg-dark-bg disabled:text-slate-400 disabled:border-slate-100 dark:disabled:border-dark-border disabled:cursor-not-allowed",
              (error || aiWarning) && "border-red-500 focus:border-red-500 focus:ring-red-500/10",
              aiSuggestion && !isAIPrefilled && "border-amber-300 bg-amber-50/20",
              isAIPrefilled && "border-primary/40 bg-primary/[0.02]",
              otherClasses
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-[12px]">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-primary",
              isAIPrefilled && "text-primary"
            )}
          >
            <ChevronDown size={16} />
          </div>
        </div>
        {(error || aiWarning) && (
          <span className="text-[10px] font-medium text-red-500 px-1">{error || aiWarning}</span>
        )}
      </div>
    );
  }
);

CortexSelect.displayName = "CortexSelect";

export { CortexSelect };
