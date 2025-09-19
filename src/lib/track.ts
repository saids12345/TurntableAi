export type AnalyticEvent = {
    ts: number;
    type: "social_generated" | "review_generated" | "sales_generated";
  };
  
  const KEY = "analyticsEvents";
  
  export function track(ev: AnalyticEvent) {
    try {
      const raw = localStorage.getItem(KEY);
      const arr: AnalyticEvent[] = raw ? JSON.parse(raw) : [];
      arr.unshift(ev);
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 1000)));
    } catch {}
  }
  
  export function getEvents(): AnalyticEvent[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  