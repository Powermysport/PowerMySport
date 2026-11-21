"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog. Layered at the same z-index as CommunityDialog (200) so
 * the scrim covers the sticky top nav (z-120); the old z-60 let the nav sit
 * above the dimming layer. Same paper surface and serif title as the other
 * community dialogs, and Escape cancels.
 */
export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isLoading, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-ink/50 fixed inset-0 z-[200]"
            onClick={isLoading ? undefined : onCancel}
          />
          <div className="pointer-events-none fixed inset-0 z-[201] flex items-center justify-center p-4">
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-action-title"
              aria-describedby="confirm-action-description"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="bg-paper pointer-events-auto w-full max-w-sm rounded-2xl p-6"
            >
              <h3
                id="confirm-action-title"
                className="font-editorial text-ink text-2xl font-normal leading-tight"
              >
                {title}
              </h3>
              <p
                id="confirm-action-description"
                className="text-ink-body mt-2 text-base leading-relaxed [overflow-wrap:anywhere]"
              >
                {description}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="border-hairline text-ink hover:bg-paper-deep btn-motion min-h-11 flex-1 rounded-md border bg-white text-base font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`btn-motion min-h-11 flex-1 rounded-md text-base font-semibold text-white disabled:opacity-50 ${
                    variant === "danger"
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-power-orange-solid hover:bg-indigo-700"
                  }`}
                >
                  {isLoading ? "Please wait" : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
