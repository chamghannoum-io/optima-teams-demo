import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { LifeBuoy, MessageCircleQuestion, X } from "lucide-react";
import { cn } from "./utils.js";

const DEFAULT_HELP_URL = "https://forms.clickup.com/7542143/f/765bz-110572/9VZNEMQP2H73EWVD23";
const STORAGE_KEY = "optima:support-widget-position";
const BUTTON_SIZE = 56;
const ACTION_SIZE = 48;
const ACTION_GAP = 12;
const MARGIN = 24;
const DRAG_THRESHOLD = 6;
// Stacking: the widget sits ABOVE the z-[70] Modal and z-[80] Sheet/Dialog
// layers (see sheet.tsx) so support stays one click away while the user is
// mid-claim — reaching it must never cost them an open drawer. It stays below
// the z-[130] support chat panel, so the panel covers the button once open.
const BACKDROP_Z = "z-[115]";
const WIDGET_Z = "z-[120]";
// Smooth, slightly bouncy spring-feel curve for the snap-back. Longer than the
// previous 260ms so the return-to-edge motion reads as deliberate rather than
// snappy, and uses an overshoot easing so it eases into place.
const SNAP_TRANSITION =
  "left 420ms cubic-bezier(0.34, 1.2, 0.36, 1), top 420ms cubic-bezier(0.34, 1.2, 0.36, 1)";

export interface SupportAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

export interface SupportWidgetProps {
  helpUrl?: string;
  label?: string;
  closeLabel?: string;
  /**
   * Entries reachable from the floating trigger. Two or more fan out of the
   * button as a menu; a single one (the default) is invoked straight from the
   * trigger, with no menu and no backdrop.
   */
  actions?: SupportAction[];
  /** Initial distance from the bottom on first render (px). Ignored once the user has dragged. */
  defaultOffsetBottom?: number;
}

interface StoredPosition {
  side: "left" | "right";
  y: number;
}

function loadStoredPosition(): StoredPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPosition>;
    if ((parsed.side === "left" || parsed.side === "right") && typeof parsed.y === "number") {
      return { side: parsed.side, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clampY(y: number, viewportH: number) {
  return Math.max(MARGIN, Math.min(viewportH - BUTTON_SIZE - MARGIN, y));
}

export function SupportWidget({
  helpUrl = DEFAULT_HELP_URL,
  label = "Contact support",
  closeLabel = "Close",
  actions,
  defaultOffsetBottom = MARGIN,
}: SupportWidgetProps) {
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  const [position, setPosition] = useState<StoredPosition>(() => {
    const h = typeof window !== "undefined" ? window.innerHeight : 768;
    const stored = typeof window !== "undefined" ? loadStoredPosition() : null;
    if (stored) return { side: stored.side, y: clampY(stored.y, h) };
    return { side: "right", y: clampY(h - BUTTON_SIZE - defaultOffsetBottom, h) };
  });
  const [open, setOpen] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    canDrag: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

  const effectiveActions: SupportAction[] = actions ?? [
    {
      id: "contact-support",
      label,
      icon: <LifeBuoy size={20} strokeWidth={1.75} />,
      onClick: () => window.open(helpUrl, "_blank", "noopener,noreferrer"),
    },
  ];
  // A single action needs no menu: fanning one item out of the trigger costs a
  // second click for nothing, so the trigger IS that action.
  const soleAction = effectiveActions.length === 1 ? effectiveActions[0]! : null;
  const triggerLabel = soleAction?.label ?? label;

  // Track viewport; clamp y when the window shrinks
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewport({ w, h });
      setPosition((prev) => ({ ...prev, y: clampY(prev.y, h) }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Persist position
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch {
      /* ignore */
    }
  }, [position]);

  // Close menu on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const idleX = position.side === "left" ? MARGIN : viewport.w - BUTTON_SIZE - MARGIN;
  const idleY = position.y;
  const buttonX = dragPos?.x ?? idleX;
  const buttonY = dragPos?.y ?? idleY;

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      canDrag: !open,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || !drag.canDrag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const x = Math.max(
      MARGIN,
      Math.min(viewport.w - BUTTON_SIZE - MARGIN, e.clientX - drag.offsetX)
    );
    const y = clampY(e.clientY - drag.offsetY, viewport.h);
    setDragPos({ x, y });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (drag.moved && dragPos) {
      const center = dragPos.x + BUTTON_SIZE / 2;
      const side: "left" | "right" = center < viewport.w / 2 ? "left" : "right";
      setPosition({ side, y: dragPos.y });
      justDraggedRef.current = true;
    }
    dragRef.current = null;
    setDragPos(null);
  };

  const handleClick = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (soleAction) {
      soleAction.onClick();
      return;
    }
    setOpen((prev) => !prev);
  };

  const buttonStyle: CSSProperties = {
    left: buttonX,
    top: buttonY,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    transition: dragPos ? "none" : SNAP_TRANSITION,
    touchAction: "none",
  };

  const labelSide = position.side; // labels render opposite to the snapped edge

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="support-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className={cn("fixed inset-0 bg-slate-900/40", BACKDROP_Z)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open &&
          effectiveActions.map((action, index) => {
            const actionY =
              idleY - (index + 1) * (ACTION_SIZE + ACTION_GAP) + (BUTTON_SIZE - ACTION_SIZE) / 2;
            const actionX = idleX + (BUTTON_SIZE - ACTION_SIZE) / 2;
            // The row spans icon + gap + label and is ONE button, so clicking the
            // label (or the space between) triggers the action — not just the icon
            // circle (OPTIMA-4108). It is anchored to whichever edge the trigger is
            // snapped to, so the circle stays aligned with the FAB while the label
            // grows inward.
            const edgeStyle =
              labelSide === "right"
                ? { right: viewport.w - (actionX + ACTION_SIZE) }
                : { left: actionX };
            return (
              <motion.button
                key={action.id}
                type="button"
                initial={{ opacity: 0, y: 16, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.85 }}
                transition={{ duration: 0.18, delay: index * 0.04 }}
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
                aria-label={action.label}
                data-testid={`support-widget-action-${action.id}`}
                style={{ top: actionY, height: ACTION_SIZE, ...edgeStyle }}
                className={cn(
                  "fixed group flex items-center gap-3 cursor-pointer",
                  WIDGET_Z,
                  "focus:outline-none focus-visible:outline-none",
                  labelSide === "right" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <span
                  style={{ width: ACTION_SIZE, height: ACTION_SIZE }}
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full",
                    "bg-white dark:bg-dark-surface text-primary dark:text-primary-300",
                    "border border-slate-200 dark:border-dark-border",
                    "shadow-md group-hover:shadow-lg",
                    "transition-colors group-hover:bg-slate-50 dark:group-hover:bg-dark-hover",
                    "group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2"
                  )}
                >
                  {action.icon}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium",
                    "bg-slate-900 text-white shadow-md"
                  )}
                >
                  {action.label}
                </span>
              </motion.button>
            );
          })}
      </AnimatePresence>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          dragRef.current = null;
          setDragPos(null);
        }}
        onClick={handleClick}
        aria-label={open ? closeLabel : triggerLabel}
        aria-expanded={soleAction ? undefined : open}
        title={open ? closeLabel : triggerLabel}
        data-testid="support-widget-trigger"
        style={buttonStyle}
        className={cn(
          "fixed flex items-center justify-center rounded-full select-none",
          WIDGET_Z,
          "bg-primary text-white",
          "shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40",
          "active:scale-[0.96]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          dragPos ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "help"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative flex items-center justify-center"
          >
            {open ? (
              <X size={26} strokeWidth={2.25} />
            ) : (
              <MessageCircleQuestion size={26} strokeWidth={1.75} />
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </>
  );
}
