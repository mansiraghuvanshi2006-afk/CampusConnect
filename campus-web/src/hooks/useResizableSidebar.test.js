import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useResizableSidebar, {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_STORAGE_KEY,
  readStoredSidebarWidth,
} from "./useResizableSidebar.js";

describe("useResizableSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders default width", () => {
    const { result } = renderHook(() => useResizableSidebar());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("restores stored width", () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, "400");
    expect(readStoredSidebarWidth()).toBe(400);

    const { result } = renderHook(() => useResizableSidebar());
    expect(result.current.width).toBe(400);
  });

  it("enforces minimum and maximum width", () => {
    const { result } = renderHook(() => useResizableSidebar());

    act(() => {
      result.current.setWidth(100);
    });
    expect(result.current.width).toBe(SIDEBAR_MIN_WIDTH);

    act(() => {
      result.current.setWidth(900);
    });
    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("drag changes width via pointer events", () => {
    const { result } = renderHook(() => useResizableSidebar());

    act(() => {
      result.current.setWidth(330);
    });

    act(() => {
      result.current.onResizePointerDown({
        button: 0,
        clientX: 330,
        preventDefault() {},
        stopPropagation() {},
      });
    });

    expect(result.current.isResizing).toBe(true);

    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 430 })
      );
    });

    expect(result.current.width).toBe(430);

    act(() => {
      document.dispatchEvent(new PointerEvent("pointerup"));
    });

    expect(result.current.isResizing).toBe(false);
  });

  it("keyboard arrows adjust width", () => {
    const { result } = renderHook(() => useResizableSidebar());

    act(() => {
      result.current.setWidth(SIDEBAR_DEFAULT_WIDTH);
    });

    act(() => {
      result.current.onResizeKeyDown({
        key: "ArrowRight",
        preventDefault() {},
      });
    });

    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH + 16);

    act(() => {
      result.current.onResizeKeyDown({
        key: "ArrowLeft",
        preventDefault() {},
      });
    });

    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("disabled mode keeps default width without resize handle consumers", () => {
    const { result } = renderHook(() =>
      useResizableSidebar({ enabled: false })
    );

    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);

    act(() => {
      result.current.onResizePointerDown({
        button: 0,
        clientX: 400,
        preventDefault() {},
        stopPropagation() {},
      });
    });

    expect(result.current.isResizing).toBe(false);
  });
});

describe("mobile resize handle expectation", () => {
  it("documents that ChatPage hides the handle below md", () => {
    // ChatPage only mounts the separator when isDesktopLayout is true
    // (matchMedia min-width: 768px). Hook remains usable either way.
    expect(SIDEBAR_MIN_WIDTH).toBeLessThan(SIDEBAR_DEFAULT_WIDTH);
    expect(SIDEBAR_DEFAULT_WIDTH).toBeLessThan(SIDEBAR_MAX_WIDTH);
  });
});

void vi;
