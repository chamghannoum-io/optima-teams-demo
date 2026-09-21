export function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg
      className="ml-1 inline-block h-3 w-3 text-slate-400"
      viewBox="0 0 10 14"
      fill="currentColor"
    >
      <path d="M5 0L9 5H1L5 0Z" opacity={dir === "asc" ? 1 : 0.3} />
      <path d="M5 14L1 9H9L5 14Z" opacity={dir === "desc" ? 1 : 0.3} />
    </svg>
  );
}
