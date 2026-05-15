"use client";

import { useEffect, useRef } from "react";
import { useStableCallback } from "./use-stable-callback";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

// Gemma は thinking モデルなので最初の delta が来るまで 30 秒近く沈黙することがある。
// それを「停滞」と誤判定しないよう、Vercel Hobby の 60 秒タイムアウトギリギリまで待つ。
const STALL_THRESHOLD_MS = 45_000;
const CHECK_INTERVAL_MS = 1000;

/**
 * AI ストリーミング中、最後にテキストが伸びた時刻からの経過時間を監視する。
 * STALL_THRESHOLD_MS データが来なければ「停滞」とみなして onStall を呼ぶ。
 * 同じセッション中に複数回発火する可能性があるので、呼び出し側で重複処理に注意。
 */
export function useStallDetector(
  status: ChatStatus,
  lastTextLength: number,
  onStall: () => void,
) {
  const lastChangeAtRef = useRef<number>(Date.now());
  const prevLengthRef = useRef<number>(lastTextLength);
  const firedRef = useRef<boolean>(false);
  const stableOnStall = useStableCallback(onStall);

  // テキストが伸びたら最終更新時刻を更新
  useEffect(() => {
    if (lastTextLength !== prevLengthRef.current) {
      prevLengthRef.current = lastTextLength;
      lastChangeAtRef.current = Date.now();
      firedRef.current = false;
    }
  }, [lastTextLength]);

  // ストリーミング中だけタイマーを回す
  useEffect(() => {
    if (status !== "submitted" && status !== "streaming") {
      // ストリームが終わったらリセット
      firedRef.current = false;
      lastChangeAtRef.current = Date.now();
      return;
    }
    lastChangeAtRef.current = Date.now();
    firedRef.current = false;
    const timer = window.setInterval(() => {
      if (firedRef.current) return;
      const elapsed = Date.now() - lastChangeAtRef.current;
      if (elapsed >= STALL_THRESHOLD_MS) {
        firedRef.current = true;
        stableOnStall();
      }
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status, stableOnStall]);
}
