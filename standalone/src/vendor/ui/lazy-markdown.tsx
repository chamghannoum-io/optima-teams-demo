import { lazy, Suspense } from "react";
import remarkGfm from "remark-gfm";

const ReactMarkdown = lazy(() => import("react-markdown"));

const markdownComponents = {
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <table
      className="w-full border-collapse border border-slate-200 dark:border-dark-border text-sm my-3"
      {...props}
    />
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-slate-50 dark:bg-dark-surface" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border border-slate-200 dark:border-dark-border px-3 py-2 text-left font-bold text-slate-900 dark:text-dark-text"
      {...props}
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td
      className="border border-slate-200 dark:border-dark-border px-3 py-2 text-slate-700 dark:text-slate-300"
      {...props}
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-2 text-sm text-slate-700 dark:text-slate-300" {...props} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold text-slate-900 dark:text-dark-text" {...props} />
  ),
};

export function LazyMarkdown({ children }: { children: string }) {
  return (
    <Suspense fallback={<div className="animate-pulse h-4 bg-slate-200 rounded" />}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </Suspense>
  );
}
