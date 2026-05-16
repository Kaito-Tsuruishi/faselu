/**
 * フロント側 ↔ サーバー側 ↔ AI の間でやり取りされる「内部トリガ」文字列の
 * 一元定義。
 *
 * これらの文字列は:
 * - フロント側が AI に送る合図（自動メッセージ）
 * - サーバー側がフェーズ判定や除外リストに使う
 * - フロント側が表示時にフィルタする（履歴に出さない）
 *
 * いずれもユーザーが目にする/打ち込むテキストではないので、表示や保存時に
 * 適切に剥がす必要がある。
 */

/** ユーザーが「最初の問いへ」ボタンを押した時にフロントが送る合図。 */
export const SESSION_START_TRIGGER = "準備できました。はじめてください。";

/** 対話が途切れたあと、ユーザーが「続きを表示」を押した時にフロントが送る合図。 */
export const CONTINUE_TRIGGER = "直前の発言の続きを、そのまま書いてください。";

/**
 * 最終分析レポートが途切れたとき、フロントが送る再生成依頼の冒頭。
 * 続きに具体的な指示が連結されるので、`startsWith` で判定する。
 */
export const REPORT_RETRY_PREFIX = "直前の最終分析レポートが途中で切れています";

/** DEBUG パネルから送るデバッグ用メッセージの冒頭。実機では使われない。 */
export const DEBUG_PREFIX = "[DEBUG]";

/**
 * メッセージテキストが「内部トリガ」かどうかを判定する。
 * これらは表示・履歴・領域カバー集計から除外する。
 */
export function isInternalTrigger(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === SESSION_START_TRIGGER) return true;
  if (trimmed === CONTINUE_TRIGGER) return true;
  if (trimmed.startsWith(REPORT_RETRY_PREFIX)) return true;
  if (trimmed.startsWith(DEBUG_PREFIX)) return true;
  return false;
}
