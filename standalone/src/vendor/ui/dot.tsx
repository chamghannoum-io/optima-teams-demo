import React from "react";
import { BADGE_COLORS, DOT_SIZES, resolveColor } from "./enhanced/badge-colors.js";
import type { BadgeColor, DotSize } from "./enhanced/badge-colors.js";
import { cn } from "./utils.js";

interface DotProps {
  color?: BadgeColor;
  status?: string;
  size?: DotSize;
  pulse?: boolean;
  className?: string;
}

const Dot: React.FC<DotProps> = ({ color, status, size = "sm", pulse = false, className = "" }) => {
  const resolved = color ?? resolveColor("auto", status ?? "");
  const dotColor = BADGE_COLORS[resolved].dot;

  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      {pulse && (
        <span className={cn("absolute inset-0 rounded-full opacity-40 animate-ping", dotColor)} />
      )}
      <span className={cn("inline-block rounded-full", dotColor, DOT_SIZES[size])} />
    </span>
  );
};

export default Dot;
export type { DotProps };
