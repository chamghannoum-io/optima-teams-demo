import React from "react";
import { motion } from "motion/react";
import { cn } from "./utils.js";

interface ActiveIndicatorProps {
  layoutId: string;
  className?: string;
}

const ActiveIndicator: React.FC<ActiveIndicatorProps> = ({ layoutId, className }) => {
  return (
    <motion.div
      layoutId={layoutId}
      className={cn("absolute bg-primary", className)}
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    />
  );
};

export default ActiveIndicator;
