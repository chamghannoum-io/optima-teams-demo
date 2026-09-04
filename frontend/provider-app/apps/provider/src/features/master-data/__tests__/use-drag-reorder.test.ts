import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useDragReorder } from "../hooks/use-drag-reorder";

describe("useDragReorder", () => {
  it("reorders live while dragging over other rows and resets on drag end", () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder(["a", "b", "c"], onReorder));

    act(() => result.current.handleDragStart(0));
    expect(result.current.dragIndex).toBe(0);

    act(() => result.current.handleDragEnter(2));
    expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"]);
    // The dragged row now lives at the hovered index
    expect(result.current.dragIndex).toBe(2);

    act(() => result.current.handleDragEnd());
    expect(result.current.dragIndex).toBeNull();
  });

  it("ignores drag-enter when idle or over the dragged row itself", () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder(["a", "b"], onReorder));

    act(() => result.current.handleDragEnter(1));
    expect(onReorder).not.toHaveBeenCalled();

    act(() => result.current.handleDragStart(1));
    act(() => result.current.handleDragEnter(1));
    expect(onReorder).not.toHaveBeenCalled();
  });
});
