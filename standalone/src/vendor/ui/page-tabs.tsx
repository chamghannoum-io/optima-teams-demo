import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { cn } from "./utils.js";

/**
 * PageTabs — Flow-layout variant of Tabs for dashboard pages.
 *
 * Unlike the DS Tabs (which use flex-1 + overflow-y-auto for panel layouts),
 * these render as normal block-flow elements so content scrolls with the page.
 */

export const PageTabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root ref={ref} className={cn("w-full", className)} {...props} />
));
PageTabs.displayName = "PageTabs";

export const PageTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex w-full h-[55px] items-center justify-center gap-2 shrink-0",
      "bg-white dark:bg-dark-surface",
      "border-b border-slate-200 dark:border-dark-border relative z-10",
      className
    )}
    {...props}
  />
));
PageTabsList.displayName = "PageTabsList";

export const PageTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const [isActive, setIsActive] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      setIsActive(el.getAttribute("data-state") === "active");
    });
    setIsActive(el.getAttribute("data-state") === "active");
    observer.observe(el, { attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);

  return (
    <TabsPrimitive.Trigger
      ref={(node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 h-full",
        "text-[10px] font-bold uppercase tracking-widest",
        "transition-colors duration-200 relative",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "text-slate-400 dark:text-slate-500",
        "hover:text-slate-600 dark:hover:text-slate-300",
        "data-[state=active]:text-primary dark:data-[state=active]:text-primary-300",
        className
      )}
      {...props}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId="page-tab-underline"
          className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary dark:bg-primary-300 rounded-full"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </TabsPrimitive.Trigger>
  );
});
PageTabsTrigger.displayName = "PageTabsTrigger";

export const PageTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
PageTabsContent.displayName = "PageTabsContent";
