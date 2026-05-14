"use client";

import { useRouter } from "next/navigation";
import { DEBUG_MOCK_RESULT } from "@/lib/debug-mock";
import { clearHistory } from "@/lib/session/history-storage";

type Props = {
  status: string;
  onForceFinal: () => void;
};

export function DebugPanel({ status, onForceFinal }: Props) {
  const router = useRouter();

  return (
    <div
      className="shrink-0 mb-4 px-3 py-2 text-[11px] flex gap-4 items-center flex-wrap"
      style={{
        border: "1px dashed #c44",
        color: "#c44",
        borderRadius: 8,
      }}
    >
      <span className="font-bold tracking-[0.1em]">DEBUG</span>
      <button
        type="button"
        onClick={onForceFinal}
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
      <button
        type="button"
        onClick={() => {
          clearHistory();
          window.location.reload();
        }}
        className="underline"
      >
        履歴クリア
      </button>
    </div>
  );
}
