import { useCallback, useState } from "react";

export interface UseDragReorderResult {
  /** Index of the row currently being dragged, or null when idle. */
  dragIndex: number | null;
  /** Attach to a row's onDragStart. */
  handleDragStart: (index: number) => void;
  /** Attach to a row's onDragEnter; live-reorders the list as the drag passes over rows. */
  handleDragEnter: (index: number) => void;
  /** Attach to a row's onDragEnd (and onDrop) to finish the gesture. */
  handleDragEnd: () => void;
}

/**
 * Native HTML5 drag-to-reorder state for a list: rows swap live while dragging
 * and the reordered array is pushed through `onReorder`.
 */
export function useDragReorder<T>(
  items: readonly T[],
  onReorder: (next: T[]) => void
): UseDragReorderResult {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => setDragIndex(index), []);

  const handleDragEnter = useCallback(
    (index: number) => {
      if (dragIndex === null || dragIndex === index) return;
      const next = [...items];
      const [moved] = next.splice(dragIndex, 1);
      if (moved === undefined) return;
      next.splice(index, 0, moved);
      onReorder(next);
      setDragIndex(index);
    },
    [dragIndex, items, onReorder]
  );

  const handleDragEnd = useCallback(() => setDragIndex(null), []);

  return { dragIndex, handleDragStart, handleDragEnter, handleDragEnd };
}
