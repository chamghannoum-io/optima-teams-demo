import type { ReactNode } from "react";
import { cn } from "../ui/utils.js";

export default function PageContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-8 space-y-6", className)}>{children}</div>;
}
