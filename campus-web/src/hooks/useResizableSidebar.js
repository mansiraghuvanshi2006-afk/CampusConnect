import { useCallback, useEffect, useRef, useState } from "react";

export const SIDEBAR_MIN_WIDTH = 260;
export const SIDEBAR_DEFAULT_WIDTH = 330;
export const SIDEBAR_MAX_WIDTH = 520;
export const SIDEBAR_STORAGE_KEY = "campusconnect.chat.sidebarWidth";

const clampWidth = (width, min = SIDEBAR_MIN_WIDTH, max = SIDEBAR_MAX_WIDTH) =>
  Math.min(max, Math.max(min, Math.round(width)));

export const readStoredSidebarWidth = (
  storage = typeof localStorage !== "undefined" ? localStorage : null
) => {
  if (!storage) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  try {
    const raw = storage.getItem(SIDEBAR_STORAGE_KEY);

    if (raw == null || raw === "") {
      return SIDEBAR_DEFAULT_WIDTH;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
      return SIDEBAR_DEFAULT_WIDTH;
    }

    return clampWidth(parsed);
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
};

/**
 * Desktop conversation-list sidebar resize with pointer events + keyboard.
 */
export default function useResizableSidebar({
  minWidth = SIDEBAR_MIN_WIDTH,
  maxWidth = SIDEBAR_MAX_WIDTH,
  defaultWidth = SIDEBAR_DEFAULT_WIDTH,
  storageKey = SIDEBAR_STORAGE_KEY,
  enabled = true,
} = {}) {
  const [width, setWidth] = useState(() => {
    if (!enabled) {
      return defaultWidth;
    }

    return readStoredSidebarWidth();
  });
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    if (!enabled || typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // Ignore quota / private mode failures.
    }
  }, [enabled, storageKey, width]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const onPointerMove = (event) => {
      const delta = event.clientX - startXRef.current;
      setWidth(clampWidth(startWidthRef.current + delta, minWidth, maxWidth));
    };

    const onPointerUp = () => {
      stopResizing();
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, maxWidth, stopResizing]);

  const onResizePointerDown = useCallback(
    (event) => {
      if (!enabled || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startXRef.current = event.clientX;
      startWidthRef.current = width;
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [enabled, width]
  );

  const onResizeKeyDown = useCallback(
    (event) => {
      if (!enabled) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setWidth((previous) =>
          clampWidth(previous - 16, minWidth, maxWidth)
        );
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setWidth((previous) =>
          clampWidth(previous + 16, minWidth, maxWidth)
        );
      } else if (event.key === "Home") {
        event.preventDefault();
        setWidth(minWidth);
      } else if (event.key === "End") {
        event.preventDefault();
        setWidth(maxWidth);
      }
    },
    [enabled, minWidth, maxWidth]
  );

  return {
    width: enabled ? width : defaultWidth,
    isResizing,
    onResizePointerDown,
    onResizeKeyDown,
    setWidth: (next) => setWidth(clampWidth(next, minWidth, maxWidth)),
    minWidth,
    maxWidth,
  };
}
