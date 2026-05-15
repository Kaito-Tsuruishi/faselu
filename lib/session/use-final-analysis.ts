"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";
import {
  FINAL_REPORT_TRIGGER,
  NEXT_TURN_CARD_JSON_TOKEN,
  buildSessionResult,
  hasReadyForFinal,
  hasReportDone,
  isSafetyTerminate,
  parseCardJson,
} from "@/lib/parse-result";
import { clearHistory } from "./history-storage";
import { useStableCallback } from "./use-stable-callback";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

type WatcherOptions = {
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: (msg: { text: string }) => void;
  textOf: (m: UIMessage) => string;
  onSafetyTerminate: () => void;
  onComplete: () => void;
};

const STUCK_TIMEOUT_MS = 45_000;
const STUCK_INTERVAL_MS = 2_000;

function useFinalAnalysisWatcher({
  messages,
  status,
  sendMessage,
  textOf,
  onSafetyTerminate,
  onComplete,
  cardRequestedRef,
  cardRequestedAtRef,
  reportRequestedRef,
}: WatcherOptions & {
  cardRequestedRef: React.MutableRefObject<boolean>;
  cardRequestedAtRef: React.MutableRefObject<number | null>;
  reportRequestedRef: React.MutableRefObject<boolean>;
}) {
  const stableSafety = useStableCallback(onSafetyTerminate);
  const stableComplete = useStableCallback(onComplete);
  const stableTextOf = useStableCallback(textOf);
  const stableSend = useStableCallback(sendMessage);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const text = stableTextOf(last);
    if (!text) return;

    if (isSafetyTerminate(text)) {
      clearHistory();
      stableSafety();
      return;
    }

    if (status !== "ready") return;

    // 対話ターンで AI が <<READY_FOR_FINAL>> だけを返してきたら、
    // 自動で最終レポート開始トリガを送って次ターン（final モード）へ移行する。
    if (hasReadyForFinal(text) && !reportRequestedRef.current) {
      reportRequestedRef.current = true;
      stableSend({ text: FINAL_REPORT_TRIGGER });
      return;
    }

    const card = parseCardJson(text);
    if (card) {
      const reportMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && hasReportDone(stableTextOf(m)));
      if (reportMsg) {
        const result = buildSessionResult(stableTextOf(reportMsg), card);
        sessionStorage.setItem("faselu-result", JSON.stringify(result));
        clearHistory();
        stableComplete();
        return;
      }
    }

    if (hasReportDone(text) && !cardRequestedRef.current) {
      cardRequestedRef.current = true;
      cardRequestedAtRef.current = Date.now();
      stableSend({ text: NEXT_TURN_CARD_JSON_TOKEN });
      return;
    }
  }, [
    messages,
    status,
    stableSafety,
    stableComplete,
    stableTextOf,
    stableSend,
    cardRequestedRef,
    cardRequestedAtRef,
    reportRequestedRef,
  ]);
}

function useStuckGuard({
  status,
  onStuck,
  cardRequestedRef,
  cardRequestedAtRef,
}: {
  status: ChatStatus;
  onStuck: () => void;
  cardRequestedRef: React.MutableRefObject<boolean>;
  cardRequestedAtRef: React.MutableRefObject<number | null>;
}) {
  const stableStuck = useStableCallback(onStuck);

  useEffect(() => {
    if (!cardRequestedRef.current || cardRequestedAtRef.current === null) {
      return;
    }
    const requestedAt = cardRequestedAtRef.current;
    const timer = window.setInterval(() => {
      if (!cardRequestedRef.current) {
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - requestedAt > STUCK_TIMEOUT_MS && status === "ready") {
        cardRequestedRef.current = false;
        cardRequestedAtRef.current = null;
        stableStuck();
        window.clearInterval(timer);
      }
    }, STUCK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status, stableStuck, cardRequestedRef, cardRequestedAtRef]);
}

export type FinalAnalysisControl = {
  /** ターン2 を手動で再要求する（タイムアウト後のリトライなど） */
  requestCardJson: () => void;
  /** ターン1 完了直後（<<REPORT_DONE>>）のときに true */
  isAwaitingCardJson: () => boolean;
};

export function useFinalAnalysis(
  opts: WatcherOptions & { onStuck: () => void },
): FinalAnalysisControl {
  const cardRequestedRef = useRef(false);
  const cardRequestedAtRef = useRef<number | null>(null);
  const reportRequestedRef = useRef(false);

  useFinalAnalysisWatcher({
    ...opts,
    cardRequestedRef,
    cardRequestedAtRef,
    reportRequestedRef,
  });

  useStuckGuard({
    status: opts.status,
    onStuck: opts.onStuck,
    cardRequestedRef,
    cardRequestedAtRef,
  });

  const stableSend = useStableCallback(opts.sendMessage);

  const requestCardJson = useCallback(() => {
    cardRequestedRef.current = true;
    cardRequestedAtRef.current = Date.now();
    stableSend({ text: NEXT_TURN_CARD_JSON_TOKEN });
  }, [stableSend]);

  const isAwaitingCardJson = useCallback(() => cardRequestedRef.current, []);

  return { requestCardJson, isAwaitingCardJson };
}
