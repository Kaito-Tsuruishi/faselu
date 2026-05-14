import type { CardData, SessionResult } from "./types";

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)\s*```/i;

export const SAFETY_TERMINATE_TOKEN = "<<SAFETY_TERMINATE>>";
export const FINAL_START_TOKEN = "<<FINAL_START>>";
export const REPORT_DONE_TOKEN = "<<REPORT_DONE>>";
export const NEXT_TURN_CARD_JSON_TOKEN = "<<NEXT_TURN_CARD_JSON>>";
export const FINAL_MODE_MARKER = "## あなたという人間の構造";

export function hasFinalStart(text: string): boolean {
  return text.includes(FINAL_START_TOKEN);
}

export function stripFinalStart(text: string): string {
  return text.replace(FINAL_START_TOKEN, "").trim();
}

export function isSafetyTerminate(text: string): boolean {
  return text.trim().startsWith(SAFETY_TERMINATE_TOKEN);
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
  const cleaned = stripReportDone(stripFinalStart(reportText));
  return { report: cleaned, card };
}

export function parseSessionResult(text: string): SessionResult | null {
  const card = parseCardJson(text);
  if (!card) return null;
  const report = text.replace(JSON_BLOCK_RE, "").trim();
  return { report, card };
}

const SENTENCE_ENDINGS = /[。．.！？!?」』）)\]】〜～…]\s*$/;

export function looksTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 24) return false;
  if (hasReportDone(trimmed)) return false;
  if (parseCardJson(trimmed)) return false;
  return !SENTENCE_ENDINGS.test(trimmed);
}
