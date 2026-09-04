import { type ReactNode, useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "./utils.js";
import type { NavItem } from "@optima/shared";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./tooltip.js";

interface AppShellProps {
  children: ReactNode;
  navItems: NavItem[];
  currentPath: string;
  onNavigate: (to: string) => void;
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
  appName?: string;
}

export function AppShell({
  children,
  navItems,
  currentPath,
  onNavigate,
  topSlot,
  bottomSlot,
}: AppShellProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close submenu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        expandedItem &&
        submenuRef.current &&
        sidebarRef.current &&
        !submenuRef.current.contains(e.target as Node) &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setExpandedItem(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedItem]);

  // Find expanded nav item data
  const expandedNavItem = expandedItem ? navItems.find((item) => item.to === expandedItem) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-app-bg dark:bg-dark-bg">
        {/* Left Sidebar - Icon rail */}
        <aside
          ref={sidebarRef}
          className="flex w-20 flex-shrink-0 flex-col items-center bg-white dark:bg-dark-surface border-r border-slate-200 dark:border-dark-border shadow-custom overflow-y-auto z-20"
        >
          {/* Logo */}
          <div className="flex h-20 w-full items-center justify-center flex-shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl p-2 transition-transform hover:scale-105">
              <img src={`${import.meta.env.BASE_URL}iohealth-fav.svg`} alt="Optima" className="h-full w-full" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col items-center gap-1 py-6 w-full px-3">
            {navItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isActive = hasChildren
                ? item.children!.some(
                    (child) =>
                      currentPath === child.to ||
                      (child.to !== "/" && currentPath.startsWith(child.to))
                  )
                : currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to));
              const isExpanded = expandedItem === item.to;

              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (hasChildren) {
                          setExpandedItem(isExpanded ? null : item.to);
                        } else {
                          setExpandedItem(null);
                          onNavigate(item.to);
                        }
                      }}
                      className={cn(
                        "relative flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-200",
                        isActive || isExpanded
                          ? "bg-gradient-to-br from-primary-50 to-white dark:from-primary-950/40 dark:to-dark-surface border-2 border-primary-400 dark:border-primary text-primary-700 dark:text-primary-300 shadow-md scale-105"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover hover:scale-105"
                      )}
                    >
                      {item.icon && (
                        <span className="flex items-center justify-center text-xl">
                          {item.icon}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {!isExpanded && (
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Bottom slot */}
          {bottomSlot && (
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-dark-border py-4 w-full flex justify-center">
              {bottomSlot}
            </div>
          )}
        </aside>

        {/* Submenu flyout panel */}
        <div
          ref={submenuRef}
          className={cn(
            "flex-shrink-0 bg-white dark:bg-dark-surface border-r border-slate-200 dark:border-dark-border shadow-lg z-10 overflow-hidden transition-all duration-300 ease-in-out",
            expandedNavItem ? "w-56 opacity-100" : "w-0 opacity-0"
          )}
        >
          {expandedNavItem && (
            <div className="flex flex-col h-full w-56">
              {/* Submenu header */}
              <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100 dark:border-dark-border">
                {expandedNavItem.icon && (
                  <span className="flex items-center justify-center text-lg text-primary dark:text-primary-300">
                    {expandedNavItem.icon}
                  </span>
                )}
                <h3 className="flex-1 text-xs font-semibold text-slate-900 dark:text-dark-text leading-tight">
                  {expandedNavItem.label}
                </h3>
                <button
                  type="button"
                  onClick={() => setExpandedItem(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-dark-hover transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Submenu items */}
              <div className="flex-1 overflow-y-auto py-2 px-2">
                {expandedNavItem.children?.map((child) => {
                  // Exact match first; for startsWith, ensure no sibling has a longer/more-specific match
                  const isExact = currentPath === child.to;
                  const isPrefix = !isExact && child.to !== "/" && currentPath.startsWith(child.to);
                  const hasBetterMatch =
                    isPrefix &&
                    expandedNavItem.children!.some(
                      (other) =>
                        other.to !== child.to &&
                        other.to.length > child.to.length &&
                        currentPath.startsWith(other.to)
                    );
                  const isChildActive = isExact || (isPrefix && !hasBetterMatch);

                  return (
                    <button
                      key={child.to}
                      type="button"
                      onClick={() => {
                        onNavigate(child.to);
                        setExpandedItem(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition-colors mb-0.5",
                        isChildActive
                          ? "bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-medium"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-hover hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      {child.icon ? (
                        <span className="flex h-5 w-5 items-center justify-center text-base flex-shrink-0">
                          {child.icon}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold flex-shrink-0",
                            isChildActive
                              ? "bg-primary-100 dark:bg-primary-900 text-primary dark:text-primary-300"
                              : "bg-slate-100 dark:bg-dark-hover text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {child.label
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{child.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — header + content */}
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {/* Top Header */}
          <header className="flex h-16 flex-shrink-0 items-center justify-end border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-6">
            {topSlot && <div className="flex w-full items-center">{topSlot}</div>}
          </header>

          {/* Main content area */}
          <main className="flex-1 min-h-0 overflow-y-auto bg-app-bg dark:bg-dark-bg">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
