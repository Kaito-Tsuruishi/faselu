"use client";

import { useEffect, useState } from "react";

const SCROLL_THRESHOLD_PX = 12;

/**
 * 対象の scroll コンテナがオーバーフローしていて、ユーザーがまだ最上部にいるとき true。
 * disabled の場合は常に false。
 */
export function useScrollHint(
  scrollRef: React.RefObject<HTMLElement | null>,
  disabled: boolean,
): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (disabled) {
      setShow(false);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      const scrollable =
        el.scrollHeight - el.clientHeight > SCROLL_THRESHOLD_PX;
      const atTop = el.scrollTop < SCROLL_THRESHOLD_PX;
      setShow(scrollable && atTop);
    };
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [scrollRef, disabled]);

  return show;
}
