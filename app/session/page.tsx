"use client";

import { type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatBubble, TypingBubble } from "@/components/ChatBubble";
import { AnalyzingOverlay } from "@/components/session/AnalyzingOverlay";
import { ConfirmOverlay } from "@/components/session/ConfirmOverlay";
import { ContinueButton } from "@/components/session/ContinueButton";
import { DebugPanel } from "@/components/session/DebugPanel";
import { ExitConfirmModal } from "@/components/session/ExitConfirmModal";
import { SafetyTerminatedView } from "@/components/session/SafetyTerminatedView";
import { Toast } from "@/components/session/Toast";
import {
  FINAL_MODE_MARKER,
  FINAL_START_TOKEN,
  NEXT_TURN_CARD_JSON_TOKEN,
  REPORT_DONE_TOKEN,
  hasReportDone,
  looksTruncated,
  parseCardJson,
} from "@/lib/parse-result";
import { clearHistory } from "@/lib/session/history-storage";
import { useEscapeKey } from "@/lib/session/use-escape-key";
import { useFinalAnalysis } from "@/lib/session/use-final-analysis";
import { useScrollHint } from "@/lib/session/use-scroll-hint";
import { useSessionChat } from "@/lib/session/use-session-chat";
import { useStallDetector } from "@/lib/session/use-stall-detector";
import { useThinkingDelay } from "@/lib/session/use-thinking-delay";
import { useToast } from "@/lib/session/use-toast";

const IS_DEV = process.env.NODE_ENV === "development";

const textOf = (m: UIMessage): string =>
  m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

const isFinalModeText = (text: string): boolean =>
  text.includes(FINAL_START_TOKEN) ||
  text.includes(FINAL_MODE_MARKER) ||
  text.includes(REPORT_DONE_TOKEN) ||
  /```json/.test(text);

export default function SessionPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [terminated, setTerminated] = useState<"safety" | null>(null);
  const [askExit, setAskExit] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hadAbort, setHadAbort] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toast = useToast();

  const handleError = useCallback(
    (err: Error) => {
      if (err.message) toast.show("通信エラーが発生しました");
    },
    [toast],
  );

  const { messages, sendMessage, stop, status, error } = useSessionChat({
    pausePersist: showConfirm || terminated !== null,
    onError: handleError,
  });

  const onSafety = useCallback(() => setTerminated("safety"), []);
  const onComplete = useCallback(() => setShowConfirm(true), []);
  const onStuck = useCallback(() => setHadAbort(true), []);

  const finalAnalysis = useFinalAnalysis({
    messages,
    status,
    sendMessage,
    textOf,
    onSafetyTerminate: onSafety,
    onComplete,
    onStuck,
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 200;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [input]);

  const userHasSpoken = messages.some(
    (m) => m.role === "user" && textOf(m) !== NEXT_TURN_CARD_JSON_TOKEN,
  );
  const aiHasReplied = messages.some(
    (m) => m.role === "assistant" && m.id !== "opening",
  );

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.id !== "opening");
  const lastAssistantText = lastAssistant ? textOf(lastAssistant) : "";
  const isFinalizing = isFinalModeText(lastAssistantText);

  const showThinking = useThinkingDelay(status);
  const lastAssistantId = lastAssistant?.id;

  // ストリーミング中の停滞検知: 15 秒データが来なければ「途切れた」とみなす
  useStallDetector(status, lastAssistantText.length, () => {
    stop();
    setHadAbort(true);
  });

  useEffect(() => {
    if (status === "error") {
      setHadAbort(true);
      return;
    }
    if (status === "submitted" || status === "streaming") {
      setHadAbort(false);
      return;
    }
    if (status === "ready" && lastAssistant) {
      // 通常の判定: 句点で終わらない長文 = 途切れている
      if (looksTruncated(lastAssistantText)) {
        setHadAbort(true);
        return;
      }
      // 最終分析モードに入っているのに、レポート完了マーカー（<<REPORT_DONE>>）も
      // カード JSON も無いまま ready に戻っているなら、途切れているとみなす。
      // リロード復元時もこの分岐で自動回復できる。
      if (
        isFinalizing &&
        !hasReportDone(lastAssistantText) &&
        !parseCardJson(lastAssistantText)
      ) {
        setHadAbort(true);
      }
    }
  }, [status, lastAssistant, lastAssistantText, isFinalizing]);

  // LINE 風スクロール。
  // - ユーザーが「最下部付近」に居る限り、新着メッセージや段落フェードインで自動追従する
  // - ユーザーが手動で上にスクロールしたら追従を止める
  // - プログラム由来のスクロールは無視する（自動追従後の scroll イベントで誤って解除しないため）
  // DOM の高さ変化を ResizeObserver/MutationObserver で監視し、
  // messages の更新タイミングに依存せず段落フェードインのたびに追従させる。
  const stickToBottomRef = useRef(true);
  const programmaticScrollUntilRef = useRef(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const goToBottom = () => {
      programmaticScrollUntilRef.current = Date.now() + 800;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    };

    const onScroll = () => {
      if (Date.now() < programmaticScrollUntilRef.current) return;
      const distFromBottom =
        container.scrollHeight - container.clientHeight - container.scrollTop;
      stickToBottomRef.current = distFromBottom < 100;
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    const maybeFollow = () => {
      if (!stickToBottomRef.current) return;
      const distFromBottom =
        container.scrollHeight - container.clientHeight - container.scrollTop;
      if (distFromBottom > 0) goToBottom();
    };

    // 子要素のサイズ変化（段落の出現、フェードインで高さが伸びる等）
    const ro = new ResizeObserver(maybeFollow);
    Array.from(container.children).forEach((child) => ro.observe(child));
    // 子要素の追加・削除（新しいバブルが追加される）も監視
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) ro.observe(n);
        });
      }
      maybeFollow();
    });
    mo.observe(container, { childList: true });

    return () => {
      container.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const last = messages[messages.length - 1];
    const container = scrollRef.current;
    if (!last || !container) return;
    if (last.role === "user") {
      stickToBottomRef.current = true;
      programmaticScrollUntilRef.current = Date.now() + 800;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEscapeKey(askExit, () => setAskExit(false));

  const showScrollHint = useScrollHint(
    scrollRef,
    userHasSpoken || aiHasReplied,
  );

  const submit = () => {
    const text = input.trim();
    if (!text || status !== "ready" || terminated) return;
    setInput("");
    sendMessage({ text });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const requestContinue = () => {
    if (status !== "ready") return;
    setHadAbort(false);
    // ターン 2 待ち（ターン 1 完了済み）の状態でこぼれた場合: カード JSON を再要求
    if (
      finalAnalysis.isAwaitingCardJson() ||
      hasReportDone(lastAssistantText)
    ) {
      finalAnalysis.requestCardJson();
      return;
    }
    // 最終分析モードのターン 1 で途切れた場合: フォーマットを守るよう明示的に指示
    if (isFinalizing) {
      sendMessage({
        text: "直前の最終分析レポートが途中で切れています。最初の見出し（## あなたという人間の構造）から残りすべてのセクションを書き直して、末尾に <<REPORT_DONE>> を必ず付けてください。",
      });
      return;
    }
    // 通常の会話で途切れた場合
    sendMessage({ text: "直前の発言の続きを、そのまま書いてください。" });
  };

  const confirmExit = () => {
    sessionStorage.removeItem("faselu-result");
    clearHistory();
    router.replace("/");
  };

  if (terminated === "safety") {
    return <SafetyTerminatedView />;
  }

  // 「続きを表示」ボタンは、最終分析中でも途切れた状態なら出す
  const showContinueButton = hadAbort && status === "ready" && !showConfirm;
  // ANALYZING オーバーレイは、最終分析が「正常に進行中」のときだけ。
  // 途切れて固まった状態（hadAbort）では消して、ユーザーが「続きを表示」を押せるようにする
  const showAnalyzingOverlay = isFinalizing && !showConfirm && !hadAbort;
  const showInputArea = userHasSpoken || aiHasReplied;

  return (
    <main className="flex flex-col w-full max-w-[720px] mx-auto px-4 sm:px-6 h-app-frame">
      <header className="shrink-0 py-5 flex items-center justify-between">
        <span
          className="text-[11px] tracking-[0.2em]"
          style={{ color: "var(--color-muted-3)" }}
        >
          FASELU
        </span>
        <button
          type="button"
          onClick={() => setAskExit(true)}
          className="tap-target px-2 -mr-2 text-[12px] tracking-[0.15em] gold-underline pb-[2px]"
          style={{ color: "var(--color-muted-1)" }}
        >
          分析を止める
        </button>
      </header>

      {IS_DEV && (
        <DebugPanel
          status={status}
          onForceFinal={() => {
            if (status !== "ready") return;
            sendMessage({
              text: "[DEBUG] 9 領域カバー判定は無視して、今すぐ最終統合分析モードに入ってください。直前の会話を踏まえて、まずターン 1 として詳細レポートを書き、末尾に <<REPORT_DONE>> を置いてください。",
            });
          }}
        />
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-4"
        style={{ scrollPaddingBottom: "120px" }}
      >
        {messages.map((m) => {
          const text = textOf(m);
          if (!text) return null;
          if (text === "準備できました。はじめてください。") return null;
          if (text === NEXT_TURN_CARD_JSON_TOKEN) return null;
          if (m.id === "opening" && aiHasReplied) return null;
          if (m.role === "assistant" && isFinalModeText(text)) return null;
          // ストリーミング中の最新 AI バブルだけ、フェードイン演出する。
          // 既に完成した過去のバブルや、復元された履歴はフェードなし。
          const isStreamingAssistant =
            m.role === "assistant" &&
            m.id === lastAssistantId &&
            (status === "submitted" || status === "streaming");
          return (
            <ChatBubble
              key={m.id}
              role={m.role === "user" ? "user" : "assistant"}
              text={text}
              fade={isStreamingAssistant}
            />
          );
        })}
        {showThinking && !isFinalizing && <TypingBubble />}
        {showContinueButton && (
          <ContinueButton
            onClick={requestContinue}
            hasNetworkError={!!error?.message}
          />
        )}
      </div>

      {!showInputArea ? (
        <div className="shrink-0 py-8 flex flex-col items-center gap-2 relative">
          {showScrollHint && (
            <div
              className="absolute -top-6 text-[11px] tracking-[0.15em] fade-in"
              style={{ color: "var(--color-muted-3)" }}
            >
              ↓ もう少し読む
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (status !== "ready") return;
              sendMessage({ text: "準備できました。はじめてください。" });
            }}
            disabled={status !== "ready"}
            className="tap-target font-serif-jp text-[17px] tracking-[0.2em] gold-underline pb-[4px] disabled:opacity-40"
            style={{ color: "var(--color-ink-text)" }}
          >
            最初の質問へ
          </button>
          {status !== "ready" && (
            <span
              className="text-[11px]"
              style={{ color: "var(--color-muted-3)" }}
            >
              準備しています…
            </span>
          )}
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="shrink-0 py-5 flex gap-3 items-end border-t safe-pad"
          style={{ borderColor: "var(--color-line-on-dark)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              const isCoarsePointer =
                typeof window !== "undefined" &&
                window.matchMedia("(hover: none) and (pointer: coarse)")
                  .matches;
              if (isCoarsePointer) return;
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={
              status === "ready"
                ? "答える（できるだけ具体的に）"
                : "AI が考え中…"
            }
            className="flex-1 resize-none bg-transparent outline-none text-[16px] leading-[1.8] py-2 overflow-y-auto"
            style={{
              borderBottom: "1px solid var(--color-line-on-dark)",
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
              color: "var(--color-ink-text)",
              maxHeight: "200px",
              fontSize: "16px",
            }}
          />
          <button
            type="submit"
            disabled={status !== "ready" || !input.trim()}
            className="tap-target px-2 -mr-2 text-[20px] gold-text font-bold disabled:opacity-30"
            aria-label="送信"
          >
            →
          </button>
        </form>
      )}

      {showAnalyzingOverlay && <AnalyzingOverlay />}
      {showConfirm && (
        <ConfirmOverlay onConfirm={() => router.replace("/session/result")} />
      )}
      {askExit && (
        <ExitConfirmModal
          onConfirm={confirmExit}
          onCancel={() => setAskExit(false)}
        />
      )}
      {toast.message && <Toast message={toast.message} />}
    </main>
  );
}
