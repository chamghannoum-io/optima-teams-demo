import React, { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "./utils.js";

type CheckboxSize = "sm" | "md";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Plain text, or rich content when part of the label needs its own styling (e.g. a mono code). */
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: CheckboxSize;
  containerClassName?: string;
  /** Renders the partial-selection state (a horizontal bar). Visual only — pair with `checked={false}` so the underlying input reflects "not all selected". */
  indeterminate?: boolean;
}

const SIZE: Record<CheckboxSize, { box: string; check: number; label: string; desc: string }> = {
  sm: { box: "w-3.5 h-3.5 rounded", check: 9, label: "text-[11px]", desc: "text-[10px]" },
  md: { box: "w-4.5 h-4.5 rounded-md", check: 11, label: "text-xs", desc: "text-[11px]" },
};

const CortexCheckbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      size = "md",
      className,
      containerClassName,
      checked,
      disabled,
      indeterminate = false,
      ...props
    },
    ref
  ) => {
    const s = SIZE[size];
    // The DOM `indeterminate` flag isn't a React attribute — it has to be set
    // via the input ref after each render. Compose with any forwarded ref.
    const innerRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate && !checked;
    }, [indeterminate, checked]);

    const isFilled = checked || indeterminate;

    return (
      <label
        className={cn(
          // `relative` makes the label the containing block for the sr-only
          // input below. Without it the clipped input resolves against a
          // distant positioned ancestor, and focusing it (i.e. any click)
          // scrolls that ancestor's scroll container to the clip rect —
          // which blanks out drawers and other tall scroll panes.
          "relative inline-flex items-start gap-2.5 select-none",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer group",
          containerClassName
        )}
      >
        <input
          type="checkbox"
          ref={(node) => {
            innerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            s.box,
            "shrink-0 mt-px border-2 flex items-center justify-center transition-all duration-150",
            "border-slate-300 dark:border-slate-600 bg-white dark:bg-dark-surface",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/25 peer-focus-visible:ring-offset-1",
            !disabled && "group-hover:border-primary/60",
            isFilled
              ? "bg-primary border-primary dark:bg-primary dark:border-primary"
              : "bg-white dark:bg-dark-surface",
            className
          )}
        >
          {indeterminate && !checked ? (
            <Minus
              size={s.check}
              strokeWidth={3.5}
              className="text-white transition-all duration-150"
            />
          ) : (
            <Check
              size={s.check}
              strokeWidth={3.5}
              className={cn(
                "text-white transition-all duration-150",
                checked ? "opacity-100 scale-100" : "opacity-0 scale-50"
              )}
            />
          )}
        </span>
        {(label || description) && (
          <span className="flex flex-col gap-0.5">
            {label && (
              <span
                className={cn(
                  s.label,
                  "font-medium leading-tight",
                  disabled
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-slate-700 dark:text-dark-text group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                )}
              >
                {label}
              </span>
            )}
            {description && (
              <span className={cn(s.desc, "text-slate-400 dark:text-slate-500 leading-tight")}>
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    );
  }
);

CortexCheckbox.displayName = "CortexCheckbox";

export { CortexCheckbox };
export type { CheckboxProps as CortexCheckboxProps, CheckboxSize as CortexCheckboxSize };
