import React from "react";
import Dot from "./dot.js";
import {
  BADGE_COLORS,
  BADGE_SIZES,
  BASE_CLASSES,
  INTERACTIVE_CLASSES,
  resolveColor,
} from "./enhanced/badge-colors.js";
import type { BadgeColor, BadgeSize } from "./enhanced/badge-colors.js";
import { cn } from "./utils.js";
import { X } from "lucide-react";

interface PillProps {
  children: React.ReactNode;
  color?: BadgeColor | "auto";
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  outline?: boolean;
  icon?: React.ElementType;
  onRemove?: () => void;
  onClick?: () => void;
  uppercase?: boolean;
  className?: string;
}

const Pill: React.FC<PillProps> = ({
  children,
  color = "auto" as const,
  size = "sm",
  dot = false,
  pulse = false,
  outline = false,
  icon: Icon,
  onRemove,
  onClick,
  uppercase = false,
  className = "",
}) => {
  const resolved = resolveColor(color, children);
  const c = BADGE_COLORS[resolved];
  const s = BADGE_SIZES[size];
  const isInteractive = !!onClick;

  return (
    <span
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        BASE_CLASSES,
        "rounded-full",
        s.fontSize,
        s.px,
        s.py,
        s.gap,
        c.bg,
        c.text,
        outline && ["border", c.border],
        isInteractive && [INTERACTIVE_CLASSES, c.ring],
        className
      )}
    >
      {dot && <Dot color={resolved} size={s.dotSize} pulse={pulse} />}
      {Icon && <Icon className={cn(s.iconSize, "shrink-0")} />}
      <span className={uppercase ? "uppercase tracking-wide" : undefined}>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0"
          aria-label="Remove"
        >
          <X className={s.removeSize} />
        </button>
      )}
    </span>
  );
};

export { Pill };
export type { PillProps };
