import type { CardData, SessionResult } from "./types";

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)\s*```/i;

export const SAFETY_TERMINATE_TOKEN = "<<SAFETY_TERMINATE>>";
export const READY_FOR_FINAL_TOKEN = "<<READY_FOR_FINAL>>";
export const REPORT_DONE_TOKEN = "<<REPORT_DONE>>";
export const NEXT_TURN_CARD_JSON_TOKEN = "<<NEXT_TURN_CARD_JSON>>";
export const FINAL_REPORT_TRIGGER = "<<BEGIN_FINAL_REPORT>>";
export const FINAL_MODE_MARKER = "## あなたという人間の構造";

export function hasReadyForFinal(text: string): boolean {
  return text.includes(READY_FOR_FINAL_TOKEN);
}

export function isSafetyTerminate(text: string): boolean {
  // モデルがプロンプトを完全には守らず、トークンの前に短い前置き
  // （「お辛いですね。」「ご心配ですが」など）を付けて返してくるケースが
  // あるため、startsWith ではなく includes で寛容に検知する。
  // 偽陽性（通常会話の中にこのトークン文字列が偶然混入する）は実用上ほぼ
  // 起きないため安全側に倒す。
  return text.includes(SAFETY_TERMINATE_TOKEN);
}

export function hasReportDone(text: string): boolean {
  return text.includes(REPORT_DONE_TOKEN);
}

export function stripReportDone(text: string): string {
  return text.replace(REPORT_DONE_TOKEN, "").trim();
}

export function parseCardJson(text: string): CardData | null {
  const match = text.match(JSON_BLOCK_RE);
  if (!match) return null;
  try {
    const card = JSON.parse(match[1]) as CardData;
    if (
      !card.key_phrase ||
      !Array.isArray(card.characteristics) ||
      card.characteristics.length < 3 ||
      !card.question_to_self ||
      !card.card_color
    ) {
      return null;
    }
    return card;
  } catch {
    return null;
  }
}

export function buildSessionResult(
  reportText: string,
  card: CardData,
): SessionResult {
  return { report: stripReportDone(reportText), card };
}

export function parseSessionResult(text: string): SessionResult | null {
  const card = parseCardJson(text);
  if (!card) return null;
  const report = text.replace(JSON_BLOCK_RE, "").trim();
  return { report, card };
}

const SENTENCE_ENDINGS = /[。．.！？!?」』）)\]】〜～…]\s*$/;
const TOPIC_TAG_TRAILING_RE = /<<TOPIC:[^>]+>>\s*$/;

export function looksTruncated(text: string): boolean {
  // 応答末尾にあるかもしれない領域タグを除いてから判定する。
  // タグはサーバーが流したまま履歴に残る設計なので、判定時には剥がす。
  const trimmed = text.replace(TOPIC_TAG_TRAILING_RE, "").trim();
  if (trimmed.length < 24) return false;
  if (hasReportDone(trimmed)) return false;
  if (parseCardJson(trimmed)) return false;
  return !SENTENCE_ENDINGS.test(trimmed);
}
