import * as React from "react";
import { cn } from "./utils.js";

/**
 * Textarea — Cortex Design System (SKILL 5.4a)
 *
 * Same surface tokens as Input, min-h-[80px], rounded-md.
 * Built-in min/max length validation, plus an optional `error` prop for
 * form-level validation (border only — the message stays with the caller).
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  "data-testid"?: string;
  /** Validation message from the form layer — paints the error border (same contract as Input). */
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, minLength, maxLength, onChange, error, "data-testid": testId, ...props }, ref) => {
    const [validationError, setValidationError] = React.useState<string>("");

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.currentTarget.value;
      let lengthError = "";
      if (minLength && value && value.length < minLength) {
        lengthError = `Minimum ${minLength} characters required`;
      }
      if (maxLength && value.length > maxLength) {
        lengthError = `Maximum ${maxLength} characters allowed`;
      }
      setValidationError(lengthError);
      onChange?.(e);
    };

    return (
      <div className="relative">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md px-4 py-3 text-sm",
            "border border-slate-200 dark:border-[#2A3141]",
            "bg-white dark:bg-[#111827]",
            "text-slate-900 dark:text-[#E2E8F0]",
            "placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:text-[11px]",
            "hover:border-slate-300 dark:hover:border-slate-600",
            "focus-visible:outline-none focus-visible:border-[#2D3670] focus-visible:ring-1 focus-visible:ring-[#2D3670]/10",
            "disabled:bg-slate-50 dark:disabled:bg-[#0B0F19] disabled:text-slate-400 disabled:cursor-not-allowed",
            "transition-all duration-300",
            (error || validationError) &&
              "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/10",
            className
          )}
          ref={ref}
          aria-invalid={error ? true : undefined}
          minLength={minLength}
          maxLength={maxLength}
          data-testid={testId}
          onChange={handleChange}
          {...props}
        />
        {validationError && (
          <span className="text-[10px] font-medium text-red-500 mt-1 block px-1">
            {validationError}
          </span>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
