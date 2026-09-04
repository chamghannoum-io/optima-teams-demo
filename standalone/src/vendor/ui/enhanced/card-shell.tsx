import React from "react";
import { cn } from "../utils.js";
import type { LucideIcon } from "lucide-react";

export interface CardShellProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  headerAction?: React.ReactNode;
  headerVariant?: "primary" | "default";
  children: React.ReactNode;
  noPadding?: boolean;
  bodyClassName?: string;
  className?: string;
}

const CardShell: React.FC<CardShellProps> = ({
  title,
  subtitle,
  icon: Icon,
  headerAction,
  headerVariant = "primary",
  children,
  noPadding = false,
  bodyClassName,
  className,
}) => {
  const titleColor =
    headerVariant === "primary"
      ? "text-primary dark:text-primary-300"
      : "text-slate-800 dark:text-dark-text";

  return (
    <div
      className={cn(
        "bg-white dark:bg-dark-surface rounded-xl shadow-custom overflow-hidden",
        className
      )}
    >
      {title && (
        <div className="h-[55px] bg-[#F8FAFC] dark:bg-dark-card px-6 flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-dark-border/50">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon size={18} className="text-primary dark:text-primary-300" />}
            <div>
              <h3 className={cn("font-bold text-sm", titleColor)}>{title}</h3>
              {subtitle && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction}
        </div>
      )}
      <div className={cn(!noPadding && !bodyClassName && "p-6", bodyClassName)}>{children}</div>
    </div>
  );
};

export default CardShell;
