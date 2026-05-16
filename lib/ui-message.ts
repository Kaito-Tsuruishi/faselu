import type { UIMessage } from "ai";

/**
 * UIMessage の text パーツだけを連結して 1 つの文字列にする。
 * Faselu のメッセージは text パーツのみで構成されているので、これで十分。
 */
export function textOf(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
