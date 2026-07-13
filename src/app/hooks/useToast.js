"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Custom hook for managing toast notifications.
 * Returns toast state and helper functions for add/remove.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toastIdCounter = useRef(0);

  const addToast = useCallback((message, type = "info") => {
    const id = ++toastIdCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
