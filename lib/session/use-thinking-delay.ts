"use client";

import { useEffect, useRef, useState } from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

const MIN_THINKING_MS = 400;

/**
 * AI が考えている演出（TypingBubble）の最低表示時間を保証する。
 * status が submitted/streaming のあいだは true。
 * streaming に切り替わっても、submitted 開始から MIN_THINKING_MS 経過するまでは true を維持する。
 */
export function useThinkingDelay(status: ChatStatus): boolean {
  const submittedAtRef = useRef<number | null>(null);
  const [showThinking, setShowThinking] = useState(false);

  useEffect(() => {
    if (status === "submitted") {
      submittedAtRef.current = Date.now();
      setShowThinking(true);
      return;
    }

    if (status === "streaming") {
      const start = submittedAtRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      if (elapsed >= MIN_THINKING_MS) {
        setShowThinking(false);
        return;
      }
      const remaining = MIN_THINKING_MS - elapsed;
      const timer = window.setTimeout(() => {
        setShowThinking(false);
      }, remaining);
      return () => window.clearTimeout(timer);
    }

    // ready / error
    setShowThinking(false);
    submittedAtRef.current = null;
  }, [status]);

  return showThinking;
}
