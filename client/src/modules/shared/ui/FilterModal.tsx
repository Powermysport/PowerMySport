"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * The "Filters" modal the search panels share: a native <dialog>, so focus is
 * trapped, Esc closes it and the page behind is inert without any extra code.
 *
 * Controlled by `open`. It closes on Esc, on the × button, and on a click on
 * the backdrop (the dialog element itself, not its content), and tells the
 * parent through `onClose` in every case.
 */
export function FilterModal({
  open,
  onClose,
  title = "Filters",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) onClose();
    };
    dialog.addEventListener("click", onBackdrop);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("click", onBackdrop);
      dialog.removeEventListener("close", onClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="border-hairline m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 id={titleId} className="text-ink text-lg font-medium">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="text-ink-muted hover:text-ink -mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
      <div className="border-hairline flex items-center justify-between gap-3 border-t px-5 py-4">
        {footer}
      </div>
    </dialog>
  );
}
