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
import { streamGoogleResponse } from "@/lib/google-direct";

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

function textOf(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function detectMode(messages: UIMessage[]): PromptMode {
  // 直近の user メッセージで明示的に final トリガが指定されていれば final。
  // それ以外は、直近の assistant メッセージが既に final モードに入っているかで判断する
  // （途中復旧・続きの再生成リクエストも final として扱うため）。
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
  if (lastUserText === FINAL_REPORT_TRIGGER) return "final";
  if (lastUserText === NEXT_TURN_CARD_JSON_TOKEN) return "final";
  if (lastAssistantText) {
    if (
      lastAssistantText.includes(READY_FOR_FINAL_TOKEN) ||
      lastAssistantText.includes(REPORT_DONE_TOKEN) ||
      lastAssistantText.includes(FINAL_MODE_MARKER)
    ) {
      return "final";
    }
  }
  return "dialogue";
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const mode = detectMode(messages);
  const system = buildSystemPrompt(mode);
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
      model: mode === "final" ? FINAL_MODEL : DIALOGUE_MODEL,
      apiKey,
      system,
      messages: modelMessages,
      temperature: 0.7,
      signal: req.signal,
      mode,
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
