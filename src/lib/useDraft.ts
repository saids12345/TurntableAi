"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Auto-save form drafts to localStorage and restore on load.
 * Also exposes `isOnline` to show offline status if desired.
 */
export function useDraft<T>(key: string, value: T, onRestore: (v: T) => void, debounceMs = 600) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const timer = useRef<any>(null);

  // restore once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) onRestore(JSON.parse(raw));
    } catch {}
    setIsOnline(navigator.onLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // save debounced
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }, debounceMs);
    return () => clearTimeout(timer.current);
  }, [key, value, debounceMs]);

  // online/offline awareness
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return { isOnline };
}
