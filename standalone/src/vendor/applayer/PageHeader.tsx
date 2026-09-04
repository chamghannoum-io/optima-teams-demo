import React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../ui/utils.js";
import Button from "../ui/button.js";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  isSubMenuCollapsed?: boolean;
  onToggleSubMenu?: () => void;
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  statusBadge,
  icon: Icon,
  action,
  isSubMenuCollapsed,
  onToggleSubMenu,
  children,
  className,
  "data-testid": dataTestId,
}) => {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "bg-white dark:bg-dark-surface border-b border-slate-200 dark:border-dark-border shrink-0",
        className
      )}
    >
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onToggleSubMenu ? (
            <Button
              variant="outline"
              size="S"
              onClick={onToggleSubMenu}
              leadingIcon={isSubMenuCollapsed ? ChevronRight : ChevronLeft}
            />
          ) : Icon ? (
            <div className="p-1.5 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400">
              <Icon size={16} />
            </div>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-dark-text tracking-tight">
                {title}
              </h1>
              {statusBadge}
            </div>
            {subtitle && (
              <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {action && <div className="flex items-center gap-3">{action}</div>}
      </div>
      {children && <div className="px-6 pb-3">{children}</div>}
    </div>
  );
};

export default PageHeader;
