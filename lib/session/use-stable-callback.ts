"use client";

import { useCallback, useRef } from "react";

/**
 * 渡された callback の参照を安定させる。
 * useEffect の依存配列に入れても、毎レンダーで再発火させない。
 * 中身は常に最新の callback を呼ぶ。
 */
export function useStableCallback<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Args) => ref.current(...args), []);
}
