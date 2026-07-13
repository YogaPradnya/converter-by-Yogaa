"use client";

import React, { useEffect, useRef } from "react";

/**
 * Lightweight confirmation modal overlay.
 * Traps focus and closes on Escape key.
 */
export default function ConfirmModal({ title, message, onConfirm, onCancel }) {
  const confirmBtnRef = useRef(null);

  // Focus confirm button on mount and handle Escape key
  useEffect(() => {
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            className="btn btn-danger-fill"
            type="button"
            onClick={onConfirm}
            ref={confirmBtnRef}
          >
            Hapus Semua
          </button>
        </div>
      </div>
    </div>
  );
}
