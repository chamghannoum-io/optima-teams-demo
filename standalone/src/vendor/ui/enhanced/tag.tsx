import React from "react";
import {
  BADGE_COLORS,
  BADGE_SIZES,
  BASE_CLASSES,
  INTERACTIVE_CLASSES,
  resolveColor,
} from "./badge-colors.js";
import type { BadgeColor, BadgeSize } from "./badge-colors.js";
import { cn } from "../utils.js";
import { X } from "lucide-react";

interface TagProps {
  children: React.ReactNode;
  color?: BadgeColor | "auto";
  size?: BadgeSize;
  uppercase?: boolean;
  outline?: boolean;
  icon?: React.ElementType;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

const Tag: React.FC<TagProps> = ({
  children,
  color = "auto" as const,
  size = "sm",
  uppercase: _uppercase = false,
  outline = false,
  icon: Icon,
  onRemove,
  onClick,
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
        "rounded-[4px] text-[10px] font-bold uppercase tracking-wider",
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
      {Icon && <Icon className={cn(s.iconSize, "shrink-0")} />}
      <span>{children}</span>
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

export default Tag;
export type { TagProps };
