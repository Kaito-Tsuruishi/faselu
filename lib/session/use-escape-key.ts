"use client";

import { useEffect } from "react";
import { useStableCallback } from "./use-stable-callback";

export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  const stableEscape = useStableCallback(onEscape);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stableEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, stableEscape]);
}
