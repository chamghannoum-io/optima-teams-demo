import { motion } from "motion/react";

export interface DataTableEmptyProps {
  /** The headline: what is not there. */
  message: string;
  /** Optional second line: what would make it appear. */
  description?: string;
  /**
   * Quiet presentation for a table embedded in a card. The card already carries an icon and a
   * heading, so repeating both here reads as a nested panel rather than as an empty table.
   */
  embedded?: boolean;
}

/**
 * What a `DataTable` shows in place of rows it does not have.
 *
 * @example <DataTableEmpty message="No rule statistics for this run" embedded />
 */
export function DataTableEmpty({ message, description, embedded = false }: DataTableEmptyProps) {
  if (embedded) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="px-6 py-12 text-center"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
        {description ? (
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{description}</p>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <svg
        className="mb-4 h-10 w-10 text-slate-200 dark:text-slate-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{message}</p>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{description}</p>
    </motion.div>
  );
}
