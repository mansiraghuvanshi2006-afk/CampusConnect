import { useEffect, useRef } from "react";

/**
 * Lightweight confirmation dialog with Escape + focus return.
 */
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requireText = null,
  confirmText = "",
  onConfirmTextChange,
  onConfirm,
  onCancel,
  busy = false,
}) => {
  const confirmRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    confirmRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        onCancel?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  const textOk =
    !requireText ||
    confirmText.trim().toLowerCase() ===
      String(requireText).trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="max-h-[min(90dvh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1e1f22] p-5 shadow-2xl"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-bold text-white"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm text-[#b5bac1]"
        >
          {description}
        </p>

        {requireText && (
          <label className="mt-4 block text-xs text-[#949ba4]">
            Type <span className="font-semibold text-white">{requireText}</span>{" "}
            to confirm
            <input
              value={confirmText}
              onChange={(event) =>
                onConfirmTextChange?.(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
              autoComplete="off"
            />
          </label>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm text-[#dbdee1] hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy || !textOk}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              destructive
                ? "bg-red-500 hover:bg-red-600"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
