/**
 * Badge — backward-compatible wrapper around Tag.
 * Maps old variant names to Optima badge colors.
 */
import React from "react";
import Tag from "./tag.js";
import type { BadgeColor } from "./badge-colors.js";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "neutral";
  className?: string;
  size?: "xs" | "sm";
}

const VARIANT_TO_COLOR: Record<string, BadgeColor> = {
  default: "neutral",
  success: "success",
  warning: "warning",
  error: "danger",
  info: "info",
  neutral: "neutral",
};

const Badge: React.FC<BadgeProps> = ({ children, variant = "default", className, size = "xs" }) => {
  return (
    <Tag
      color={VARIANT_TO_COLOR[variant] ?? "neutral"}
      size={size}
      outline
      uppercase
      className={className}
    >
      {children}
    </Tag>
  );
};

export default Badge;
