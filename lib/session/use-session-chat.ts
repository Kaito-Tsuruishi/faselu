"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { OPENING_DECLARATION } from "@/lib/prompt";
import { loadStoredHistory, saveHistory } from "./history-storage";
import { useStableCallback } from "./use-stable-callback";

const OPENING_MESSAGE: UIMessage = {
  id: "opening",
  role: "assistant" as const,
  parts: [{ type: "text", text: OPENING_DECLARATION }],
};

type Options = {
  pausePersist: boolean;
  onError?: (error: Error) => void;
};

export function useSessionChat({ pausePersist, onError }: Options) {
  const stableOnError = useStableCallback(onError ?? (() => {}));

  const chat = useChat<UIMessage>({
    transport: new DefaultChatTransport<UIMessage>(),
    messages: [OPENING_MESSAGE],
    onError: (err) => stableOnError(err),
  });

  const { messages, setMessages, status } = chat;
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stored = loadStoredHistory();
    if (stored && stored.length > 0) {
      setMessages(stored);
    }
  }, [setMessages]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (pausePersist) return;
    if (status !== "ready") return;
    saveHistory(messages);
  }, [messages, pausePersist, status]);

  return chat;
}
