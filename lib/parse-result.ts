import type { CardData, SessionResult } from "./types";

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)\s*```/i;

export function parseSessionResult(text: string): SessionResult | null {
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

    const report = text.replace(JSON_BLOCK_RE, "").trim();
    return { report, card };
  } catch {
    return null;
  }
}

export const SAFETY_TERMINATE_TOKEN = "<<SAFETY_TERMINATE>>";

export function isSafetyTerminate(text: string): boolean {
  return text.trim().startsWith(SAFETY_TERMINATE_TOKEN);
}
