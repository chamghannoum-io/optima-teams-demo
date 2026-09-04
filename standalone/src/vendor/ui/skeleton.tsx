import type { HTMLAttributes } from "react";
import { cn } from "./utils.js";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-[#1A2234]", className)}
      {...props}
    />
  );
}
