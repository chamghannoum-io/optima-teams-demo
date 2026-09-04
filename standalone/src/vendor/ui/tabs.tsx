import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { cn } from "./utils.js";

/**
 * Tabs — Cortex Design System (SKILL §5.16)
 *
 * Underline variant (default):
 *   TabsList:    h-[55px], centered, border-b, bg-white dark:bg-dark-surface
 *   TabsTrigger: text-[10px] font-bold uppercase tracking-widest
 *                Active: text-primary dark:text-primary-300 + h-0.5 underline bar
 *                Inactive: text-slate-400 dark:text-slate-500
 *   TabsContent: flex-1 overflow-y-auto, inner padding max-w-[1400px] px-8 py-8
 */

export const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    className={cn("flex-1 flex flex-col overflow-hidden", className)}
    {...props}
  />
));
Tabs.displayName = TabsPrimitive.Root.displayName;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // §5.16: h-[55px], centered, gap-2
      "flex w-full h-[55px] items-center justify-center gap-2 shrink-0",
      // §5.16: bg-white dark:bg-dark-surface
      "bg-white dark:bg-dark-surface",
      // §5.16: border-b — standard visible border, z-10 to stay above scrollable content
      "border-b border-slate-200 dark:border-dark-border relative z-10",
      // Scrollable when overflows
      "overflow-x-auto",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
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
      ref={(node) => {
        triggerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap px-5 h-full",
        "text-[10px] font-bold uppercase tracking-widest",
        "transition-colors duration-200 relative group",
        "ring-offset-white dark:ring-offset-dark-surface",
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
          layoutId="tab-underline"
          className="tab-underline absolute bottom-0 left-2 right-2 h-0.5 bg-primary dark:bg-primary-300 rounded-full"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      // §5.16: flex-1 overflow-y-auto
      "flex-1 overflow-y-auto",
      "ring-offset-white dark:ring-offset-dark-surface",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      "data-[state=active]:flex data-[state=active]:flex-col",
      className
    )}
    {...props}
  >
    {/* No built-in padding — pages use <PageContent> for padded sections
        and render filter bars directly for stitched layout */}
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex-1 flex flex-col w-full"
    >
      {props.children}
    </motion.div>
  </TabsPrimitive.Content>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
