"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; msg: string; type?: "success" | "error" | "info" };
const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s, { id, ...t }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 2500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
        <div className="flex w-full max-w-md flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-4 py-2 text-sm shadow ${
                t.type === "error"
                  ? "border-red-500/30 bg-red-950/30 text-red-100"
                  : t.type === "success"
                  ? "border-green-500/20 bg-green-900/30 text-green-100"
                  : "border-white/10 bg-black/60 text-white/90"
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}





