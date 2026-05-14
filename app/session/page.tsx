"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatBubble, TypingBubble } from "@/components/ChatBubble";
import { OPENING_DECLARATION } from "@/lib/prompt";
import {
  isSafetyTerminate,
  parseSessionResult,
} from "@/lib/parse-result";
import { DEBUG_MOCK_RESULT } from "@/lib/debug-mock";

const IS_DEV = process.env.NODE_ENV === "development";

const textOf = (m: UIMessage): string =>
  m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

export default function SessionPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [terminated, setTerminated] = useState<"safety" | null>(null);
  const [askExit, setAskExit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 240;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [input]);

  const { messages, sendMessage, status } = useChat<UIMessage>({
    transport: new DefaultChatTransport<UIMessage>(),
    messages: [
      {
        id: "opening",
        role: "assistant" as const,
        parts: [
          {
            type: "text",
            text: OPENING_DECLARATION,
          },
        ],
      },
    ],
  });

  const userHasSpoken = messages.some((m) => m.role === "user");
  const aiHasReplied = messages.some(
    (m) => m.role === "assistant" && m.id !== "opening",
  );

  const FINAL_MODE_MARKER = "## あなたという人間の構造";
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.id !== "opening");
  const isFinalizing =
    !!lastAssistant && textOf(lastAssistant).includes(FINAL_MODE_MARKER);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const text = textOf(last);
    if (!text) return;

    if (isSafetyTerminate(text)) {
      setTerminated("safety");
      return;
    }

    if (status === "ready") {
      const result = parseSessionResult(text);
      if (result) {
        sessionStorage.setItem("faselu-result", JSON.stringify(result));
        router.replace("/session/result");
      }
    }
  }, [messages, status, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

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

  const confirmExit = () => {
    sessionStorage.removeItem("faselu-result");
    router.replace("/");
  };

  if (terminated === "safety") {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[520px]">
          <p
            className="font-serif-jp text-[16px] leading-[2.1]"
            style={{ color: "var(--color-ink-text)", whiteSpace: "pre-wrap" }}
          >
            ここまで話してくれてありがとう。
            {"\n"}
            ただ、今のあなたが必要としているのは、
            {"\n"}
            このサービスのような踏み込んだ分析ではなく、
            {"\n"}
            信頼できる人や、専門的な支援だと感じました。
            {"\n\n"}
            このセッションはここで終わります。
            {"\n"}
            ここまでの会話は保存されません。
            {"\n\n"}
            どうか、自分を大事にしてください。
          </p>
          <div className="mt-12">
            <a
              href="/"
              className="font-serif-jp inline-block text-[14px] gold-underline pb-[2px]"
              style={{ color: "var(--color-ink-text)" }}
            >
              トップへ戻る
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex flex-col w-full max-w-[720px] mx-auto px-4 sm:px-6"
      style={{ height: "100dvh" }}
    >
      <header className="shrink-0 py-6 flex items-center justify-between">
        <span
          className="text-[11px] tracking-[0.2em]"
          style={{ color: "var(--color-muted-3)" }}
        >
          FASELU
        </span>
        <button
          type="button"
          onClick={() => setAskExit(true)}
          className="text-[11px] tracking-[0.15em]"
          style={{ color: "var(--color-muted-3)" }}
        >
          分析を止める
        </button>
      </header>

      {IS_DEV && (
        <div
          className="shrink-0 mb-4 px-3 py-2 text-[11px] flex gap-4 items-center"
          style={{
            border: "1px dashed #c44",
            color: "#c44",
            borderRadius: 8,
          }}
        >
          <span className="font-bold tracking-[0.1em]">DEBUG</span>
          <button
            type="button"
            onClick={() => {
              if (status !== "ready") return;
              sendMessage({
                text: "[DEBUG] 深掘り基準は無視して、今すぐ最終統合分析モードに入ってください。直前の会話を踏まえて、詳細レポートと末尾のカード用 JSON を出力してください。",
              });
            }}
            disabled={status !== "ready"}
            className="underline disabled:opacity-40"
          >
            最終分析を強制発動（実 LLM）
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(
                "faselu-result",
                JSON.stringify(DEBUG_MOCK_RESULT),
              );
              router.push("/session/result");
            }}
            className="underline"
          >
            ダミー結果画面へ（API 不要）
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-4"
      >
        {messages.map((m) => {
          const text = textOf(m);
          if (!text) return null;
          if (text === "準備できました。はじめてください。") return null;
          if (m.id === "opening" && aiHasReplied) return null;
          if (
            m.role === "assistant" &&
            text.includes(FINAL_MODE_MARKER)
          )
            return null;
          return (
            <ChatBubble
              key={m.id}
              role={m.role === "user" ? "user" : "assistant"}
              text={text}
            />
          );
        })}
        {status === "submitted" && !isFinalizing && <TypingBubble />}
      </div>

      {!userHasSpoken ? (
        <div className="shrink-0 py-10 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (status !== "ready") return;
              sendMessage({ text: "準備できました。はじめてください。" });
            }}
            disabled={status !== "ready"}
            className="font-serif-jp text-[17px] tracking-[0.2em] gold-underline pb-[4px] disabled:opacity-40"
            style={{ color: "var(--color-ink-text)" }}
          >
            最初の質問へ
          </button>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="shrink-0 py-6 flex gap-3 items-end border-t"
          style={{ borderColor: "var(--color-line-on-dark)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
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
                ? "答える（できるだけ具体的に。Enter で送信 / Shift+Enter で改行）"
                : "AI が考え中…"
            }
            className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-[1.8] py-2 overflow-y-auto"
            style={{
              borderBottom: "1px solid var(--color-line-on-dark)",
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
              color: "var(--color-ink-text)",
              maxHeight: "240px",
            }}
          />
          <button
            type="submit"
            disabled={status !== "ready" || !input.trim()}
            className="text-[18px] gold-text font-bold pb-2 disabled:opacity-30"
            aria-label="送信"
          >
            →
          </button>
        </form>
      )}

      {isFinalizing && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(10, 10, 12, 0.95)" }}
        >
          <div className="text-center">
            <div
              className="text-[11px] tracking-[0.3em] gold-text font-bold mb-6"
              style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
            >
              ANALYZING
            </div>
            <p
              className="font-serif-jp text-[17px] leading-[2.1] mb-10"
              style={{ color: "var(--color-ink-text)" }}
            >
              分析しています。
              <br />
              そのまま待ってください。
            </p>
            <div className="inline-flex gap-[6px] items-center">
              <span
                className="typing-dot inline-block w-[6px] h-[6px] rounded-full"
                style={{ backgroundColor: "var(--color-ink-text-soft)" }}
              />
              <span
                className="typing-dot inline-block w-[6px] h-[6px] rounded-full"
                style={{ backgroundColor: "var(--color-ink-text-soft)" }}
              />
              <span
                className="typing-dot inline-block w-[6px] h-[6px] rounded-full"
                style={{ backgroundColor: "var(--color-ink-text-soft)" }}
              />
            </div>
          </div>
        </div>
      )}

      {askExit && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(10, 10, 12, 0.85)" }}
        >
          <div
            className="rounded-[24px] p-10 max-w-[420px] w-full"
            style={{
              backgroundColor: "rgba(20, 20, 24, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <p
              className="font-serif-jp text-[15px] leading-[2] mb-8"
              style={{ color: "var(--color-ink-text)" }}
            >
              ここで止めると、ここまでの会話は破棄され、
              <br />
              分析結果も発行されません。
              <br />
              本当にやめますか？
            </p>
            <div className="flex gap-6 items-center">
              <button
                type="button"
                onClick={confirmExit}
                className="font-serif-jp text-[13px] gold-underline pb-[2px]"
                style={{ color: "var(--color-ink-text)" }}
              >
                止める
              </button>
              <button
                type="button"
                onClick={() => setAskExit(false)}
                className="font-serif-jp text-[13px]"
                style={{ color: "var(--color-muted-1)" }}
              >
                続ける
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
