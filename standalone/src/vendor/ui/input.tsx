import * as React from "react";
import { cn } from "./utils.js";

/**
 * Input — Cortex Design System (SKILL 5.2)
 *
 * h-[40px] rounded-md, border-slate-200 dark:border-dark-border
 * focus:border-primary focus:ring-1 focus:ring-primary/10
 * text-xs, placeholder text-[11px]
 * error: border-red-500 focus:ring-red-500/10
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  "data-testid"?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, "data-testid": testId, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          type={type}
          className={cn(
            "flex h-[40px] w-full rounded-md px-4 text-xs",
            "border border-slate-200 dark:border-dark-border",
            "bg-white dark:bg-dark-surface",
            "text-slate-900 dark:text-dark-text",
            "placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:text-[11px]",
            "hover:border-slate-300 dark:hover:border-slate-600",
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/10",
            "disabled:bg-slate-50 dark:disabled:bg-dark-bg disabled:text-slate-400 disabled:cursor-not-allowed",
            "transition-all duration-300",
            error && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/10",
            className
          )}
          ref={ref}
          data-testid={testId}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
