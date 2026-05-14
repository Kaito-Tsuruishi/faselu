import type { UIMessage } from "ai";

export const HISTORY_KEY = "faselu-session-history";

export function loadStoredHistory(): UIMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UIMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveHistory(messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  } catch {
    // QuotaExceeded などは無視
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(HISTORY_KEY);
  } catch {
    // 失敗しても続行
  }
}
