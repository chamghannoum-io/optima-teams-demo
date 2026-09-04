import React, { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils.js";
import ActiveIndicator from "./active-indicator.js";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeId: T;
  onChange: React.Dispatch<React.SetStateAction<T>>;
  layoutId: string;
  variant?: "underline" | "pill" | "bar";
  className?: string;
}

function CortexTabs<T extends string>({
  items,
  activeId,
  onChange,
  layoutId,
  variant = "underline",
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, currentId: T) => {
    const idx = items.findIndex((t) => t.id === currentId);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = (idx + 1) % items.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = (idx - 1 + items.length) % items.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      next = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      next = items.length - 1;
    }
    const nextItem = next >= 0 ? items[next] : undefined;
    if (nextItem) {
      onChange(nextItem.id);
      const btns = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      btns?.[next]?.focus();
    }
  };

  if (variant === "pill") {
    return (
      <div
        ref={listRef}
        role="tablist"
        className={cn(
          "flex justify-center bg-slate-100 dark:bg-dark-elevated p-1 rounded-lg",
          className
        )}
      >
        {items.map((tab) => {
          const isActive = activeId === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all relative flex items-center gap-2",
                isActive
                  ? "text-primary dark:text-primary-300 bg-white dark:bg-dark-surface"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              )}
            >
              {Icon && <Icon size={14} />}
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9px]",
                    isActive
                      ? "bg-primary/10 text-primary dark:text-primary-300"
                      : "bg-slate-200 dark:bg-dark-border text-slate-500 dark:text-slate-400"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: underline variant
  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        "h-[55px] flex items-center justify-center border-b border-slate-100 dark:border-dark-border/50 bg-white dark:bg-dark-surface px-6 shrink-0 gap-2",
        className
      )}
    >
      {items.map((tab) => {
        const isActive = activeId === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={cn(
              "px-4 h-full text-[10px] font-bold uppercase tracking-widest transition-all relative flex items-center gap-2 group",
              isActive
                ? "text-primary dark:text-primary-300"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
            )}
          >
            {isActive && (
              <ActiveIndicator
                layoutId={layoutId}
                className="bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
            {Icon && (
              <Icon
                size={14}
                className={cn(
                  isActive
                    ? "text-primary dark:text-primary-300"
                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600"
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px]",
                  isActive
                    ? "bg-primary/10 text-primary dark:text-primary-300"
                    : "bg-slate-200 dark:bg-dark-border text-slate-500 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { CortexTabs };
