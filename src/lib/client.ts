// src/lib/client.ts

// ---- History helpers (localStorage) ----
export type HistoryItem = {
    id: string;         // unique id
    createdAt: number;  // Date.now()
    title: string;      // short label
    text: string;       // full content
  };
  
  export function loadHistory(key: string, max = 50): HistoryItem[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw) as HistoryItem[];
      return Array.isArray(arr) ? arr.slice(0, max) : [];
    } catch {
      return [];
    }
  }
  
  export function saveHistory(key: string, item: HistoryItem) {
    try {
      const current = loadHistory(key);
      const next = [item, ...current].slice(0, 50);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  
  export function clearHistory(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  
  // ---- Download helper ----
  export function downloadText(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  // ---- Fetch with retry (exponential backoff) ----
  type RetryOpts = { retries?: number; baseMs?: number; signal?: AbortSignal };
  export async function fetchWithRetry(
    input: RequestInfo | URL,
    init: RequestInit & RetryOpts = {}
  ) {
    const { retries = 2, baseMs = 400, signal, ...rest } = init;
    let attempt = 0, lastErr: any = null;
    while (attempt <= retries) {
      try {
        const res = await fetch(input, { ...rest, signal });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const msg = json?.error || `${res.status} ${res.statusText}`;
          throw new Error(msg);
        }
        return res;
      } catch (e: any) {
        if (signal?.aborted) throw e;
        lastErr = e;
        if (attempt === retries) break;
        const wait = baseMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
      }
    }
    throw lastErr || new Error("Network error");
  }
  