"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_TIMEOUT_MS = 2200;

export function useToast(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), timeoutMs);
    return () => window.clearTimeout(t);
  }, [message, timeoutMs]);

  const show = useCallback((text: string) => setMessage(text), []);
  const dismiss = useCallback(() => setMessage(null), []);

  return { message, show, dismiss };
}
