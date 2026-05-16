import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { buildSystemPrompt, type PromptMode } from "@/lib/prompt";
import {
  FINAL_MODE_MARKER,
  FINAL_REPORT_TRIGGER,
  NEXT_TURN_CARD_JSON_TOKEN,
  READY_FOR_FINAL_TOKEN,
  REPORT_DONE_TOKEN,
} from "@/lib/parse-result";
import { inferDialogueContext } from "@/lib/dialogue-phase";
import { streamGoogleResponse } from "@/lib/google-direct";
import { textOf } from "@/lib/ui-message";

export const maxDuration = 60;

const PROVIDER = process.env.FASELU_PROVIDER ?? "gemini";

// モード別モデル選択。
// - 対話モードは応答回数が多くテンポ重視 → 軽量な Gemma 26b がデフォルト。
// - 最終分析モードはレポート品質重視 + Gemini Flash Lite の方が free tier
//   制限内で安定 → Gemini 3.1 Flash Lite がデフォルト。
// 旧来の FASELU_GEMINI_MODEL は後方互換のフォールバックとして残す。
const FALLBACK_MODEL =
  process.env.FASELU_GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const DIALOGUE_MODEL =
  process.env.FASELU_DIALOGUE_MODEL ?? FALLBACK_MODEL;
const FINAL_MODEL = process.env.FASELU_FINAL_MODEL ?? FALLBACK_MODEL;

function detectMode(messages: UIMessage[]): PromptMode {
  // 直近の user メッセージで明示的に final トリガが指定されていれば final。
  // それ以外は、直近の assistant メッセージが既に final モードに入っているかで判断する
  // （途中復旧・続きの再生成リクエストも final として扱うため）。
  //
  // final はさらに 2 ターンに分かれる:
  // - final-card:   直近 user が <<NEXT_TURN_CARD_JSON>>、または直近 assistant が
  //                 既にカード JSON 生成を始めている（途中復旧時のため）
  // - final-report: それ以外の final 判定（レポート本文を生成中 or これから書く）
  let lastUserText: string | null = null;
  let lastAssistantText: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const text = textOf(m);
    if (!text) continue;
    if (m.role === "user" && lastUserText === null) lastUserText = text;
    if (m.role === "assistant" && lastAssistantText === null)
      lastAssistantText = text;
    if (lastUserText !== null && lastAssistantText !== null) break;
  }

  if (lastUserText === NEXT_TURN_CARD_JSON_TOKEN) return "final-card";

  if (lastUserText === FINAL_REPORT_TRIGGER) return "final-report";

  if (lastAssistantText) {
    if (
      lastAssistantText.includes(READY_FOR_FINAL_TOKEN) ||
      lastAssistantText.includes(REPORT_DONE_TOKEN) ||
      lastAssistantText.includes(FINAL_MODE_MARKER)
    ) {
      // REPORT_DONE が出ているならレポートは完了済み → 次はカードターン
      if (lastAssistantText.includes(REPORT_DONE_TOKEN)) return "final-card";
      return "final-report";
    }
  }
  return "dialogue";
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const mode = detectMode(messages);
  const isFinal = mode === "final-report" || mode === "final-card";
  // 対話モードのときだけ、メッセージ履歴からフェーズと領域カバー状態を推論して
  // プロンプトに反映する。最終分析モードでは履歴の流れが固定なのでコンテキストは不要。
  const dialogueContext = !isFinal ? inferDialogueContext(messages) : undefined;
  const system = buildSystemPrompt(mode, dialogueContext);
  const modelMessages = await convertToModelMessages(messages);

  // Google モデル（gemini-* / gemma-*）は無料 tier で 500/503 transient エラーが
  // 頻発するので、リトライ機構を持つ直叩きルートに通す。@ai-sdk/google 経由だと
  // リトライ機構を簡単に挟めないため。
  if (PROVIDER === "gemini") {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response("GOOGLE_GENERATIVE_AI_API_KEY is not set", {
        status: 500,
      });
    }
    return streamGoogleResponse({
      model: isFinal ? FINAL_MODEL : DIALOGUE_MODEL,
      apiKey,
      system,
      messages: modelMessages,
      temperature: 0.7,
      signal: req.signal,
      // SENTINEL 監視は「対話ターンかどうか」だけが必要なので、final-* は
      // "final" に集約して渡す。
      mode: isFinal ? "final" : "dialogue",
    });
  }

  if (PROVIDER === "groq") {
    const result = streamText({
      model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      system,
      messages: modelMessages,
      temperature: 0.7,
    });
    return result.toUIMessageStreamResponse();
  }

  return new Response(`Unknown FASELU_PROVIDER: ${PROVIDER}`, { status: 500 });
}
