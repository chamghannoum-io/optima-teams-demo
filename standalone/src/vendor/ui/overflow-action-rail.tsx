import { useMemo, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { MoreVertical } from "lucide-react";
import { cn } from "./utils.js";

/** One action managed by the {@link OverflowActionRail}. */
export interface OverflowRailItem {
  /** Stable identity; a changed set re-measures the rail. */
  key: string;
  /** Inline form, rendered while the rail has room for it. */
  button: ReactNode;
  /**
   * Menu-row form, rendered inside the "more" menu once the button stops
   * fitting. Must be a single element — unless {@link keepOpenOnClick} is set
   * it is cloned as the popover's close trigger. Omit it to PIN the action:
   * pinned actions never overflow (use for purely decorative rail content,
   * e.g. a divider).
   */
  menuItem?: ReactNode;
  /**
   * Don't close the "more" menu when the menu row is clicked — required for
   * rows that open their own nested popover or submenu (assignment picker,
   * resubmit-type picker…), which must stay mounted while the user interacts.
   */
  keepOpenOnClick?: boolean;
}

/** Props for {@link OverflowActionRail}. */
export interface OverflowActionRailProps {
  /**
   * Actions in visual order, least important first — when space runs out the
   * LEFTMOST unpinned actions move into the menu first, so put the primary
   * actions at the end.
   */
  items: OverflowRailItem[];
  className?: string;
  /** Accessible label + tooltip of the overflow trigger. */
  menuLabel?: string;
  /** Extra classes for the popover panel (e.g. a z-index override). */
  menuClassName?: string;
  /** Test id of the overflow trigger button. */
  menuTestId?: string;
}

const ITEM_GAP = 8; // matches the rail's gap-2
const TRIGGER_WIDTH = 36; // p-2 icon button

/**
 * Priority+ action rail: renders as many actions inline as the available width
 * allows and moves the rest, one by one, into a trailing "more" (kebab) menu.
 * Give it the flexible slot of a toolbar (`flex-1 min-w-0`) — it measures a
 * hidden copy of every action, watches its own width with a ResizeObserver,
 * and re-balances on resize or when an action's label changes width.
 */
export function OverflowActionRail({
  items,
  className,
  menuLabel = "More actions",
  menuClassName,
  menuTestId,
}: OverflowActionRailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // Index of the first VISIBLE unpinned item; everything unpinned before it overflows.
  const [overflowBefore, setOverflowBefore] = useState(0);
  // The rail refuses to shrink below its pinned buttons + the menu trigger —
  // without this, a squeezed rail clips them (the flexible siblings, e.g. a
  // truncating title, must give way instead).
  const [minWidthPx, setMinWidthPx] = useState(TRIGGER_WIDTH);
  const railStyle = useMemo(() => ({ minWidth: minWidthPx }), [minWidthPx]);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const available = container.clientWidth;
    const nodes = Array.from(measure.children) as HTMLElement[];
    const widths = nodes.map((node) => node.offsetWidth);
    const pinned = nodes.map((node) => node.dataset.pinned === "true");
    const totalAll = widths.reduce((sum, w, i) => sum + w + (i > 0 ? ITEM_GAP : 0), 0);

    let pinnedTotal = 0;
    let hasUnpinned = false;
    for (let i = 0; i < widths.length; i++) {
      if (pinned[i]) pinnedTotal += ITEM_GAP + (widths[i] ?? 0);
      else hasUnpinned = true;
    }
    setMinWidthPx(pinnedTotal + (hasUnpinned ? TRIGGER_WIDTH + ITEM_GAP : 0));

    if (totalAll <= available) {
      setOverflowBefore(0);
      return;
    }
    // Not everything fits: reserve the trigger, always keep the pinned items,
    // then keep unpinned ones from the END (most important) until the next
    // one no longer fits — the leftmost actions overflow first.
    let used = TRIGGER_WIDTH + pinnedTotal;
    let firstVisible = widths.length;
    for (let i = widths.length - 1; i >= 0; i--) {
      if (pinned[i]) continue;
      const next = used + ITEM_GAP + (widths[i] ?? 0);
      if (next > available) break;
      used = next;
      firstVisible = i;
    }
    setOverflowBefore(firstVisible === widths.length ? widths.length : firstVisible);
  }, []);

  useLayoutEffect(() => {
    // DOM measurement: the overflow count can only be derived after layout, and
    // must be applied before paint so the rail never flashes an overflowing row.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute();
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container) return;
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    // The hidden copy resizes when a label changes (e.g. "Evaluating…").
    if (measure) observer.observe(measure);
    return () => observer.disconnect();
  }, [recompute, items]);

  const isVisible = (item: OverflowRailItem, index: number) =>
    !item.menuItem || index >= overflowBefore;
  const overflow = items.filter((item, index) => !isVisible(item, index));

  return (
    <div
      ref={containerRef}
      style={railStyle}
      className={cn(
        "relative flex flex-1 items-center justify-end gap-2 overflow-hidden",
        className
      )}
    >
      {/* Hidden measuring copy — every action in button form so recompute()
          can read each width regardless of what is currently visible. `inert`
          keeps the copies out of focus order and event handling entirely. */}
      <div
        ref={measureRef}
        aria-hidden
        inert
        className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-2"
      >
        {items.map((item) => (
          <span key={item.key} data-pinned={!item.menuItem} className="inline-flex shrink-0">
            {item.button}
          </span>
        ))}
      </div>
      {items.map((item, index) =>
        isVisible(item, index) ? (
          <span key={item.key} className="inline-flex shrink-0">
            {item.button}
          </span>
        ) : null
      )}
      {/* The "more" trigger sits at the right end of the bar. */}
      {overflow.length > 0 && (
        <PopoverPrimitive.Root>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              title={menuLabel}
              aria-label={menuLabel}
              data-testid={menuTestId}
              className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:text-slate-500 dark:hover:bg-dark-hover"
            >
              <MoreVertical size={18} />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={6}
              className={cn(
                "z-[95] w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-dark-border dark:bg-dark-surface",
                menuClassName
              )}
            >
              {overflow.map((item) =>
                item.keepOpenOnClick ? (
                  <span key={item.key} className="block">
                    {item.menuItem}
                  </span>
                ) : (
                  <PopoverPrimitive.Close key={item.key} asChild>
                    {item.menuItem}
                  </PopoverPrimitive.Close>
                )
              )}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </div>
  );
}
