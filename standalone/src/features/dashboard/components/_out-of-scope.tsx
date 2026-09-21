/**
 * The My Day tab's panels.
 *
 * The ported rcm-dashboard has two tabs. My Team is the supervisor view and is
 * what this module is about, so every panel on it is the real upstream
 * component. My Day is the signed-in user's personal work queue, and its five
 * panels pull in the router, query-management and the claim and authorisation
 * feature modules, which are whole features outside the Teams extraction.
 *
 * They are named here rather than rendered as something plausible: a personal
 * queue invented out of nothing would be the one part of this page that is not
 * telling the truth.
 */
import { EmptyState } from "@optima/ui";
import { CalendarClock } from "lucide-react";

export function OutOfScopePanel({ title, note }: { title: string; note: string }) {
  return (
    <EmptyState
      icon={<CalendarClock size={26} className="text-slate-400" />}
      title={title}
      description={note}
      className="rounded-xl border border-dashed border-slate-200 py-12 dark:border-dark-border"
    />
  );
}
