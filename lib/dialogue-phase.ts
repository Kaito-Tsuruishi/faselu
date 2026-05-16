/**
 * 対話モードのフェーズと領域カバー状態を、メッセージ履歴から推論する。
 * 加えて、フェーズに応じた追加プロンプトをここで組み立てる。
 *
 * 設計意図:
 * - prompt.ts は「永続的なルール文字列」だけを持ち、ランタイム判断を持たない。
 * - dialogue-phase.ts は「メッセージ履歴から状態を計算してプロンプトを組む」
 *   というランタイム的な責務を持つ。
 * - AI に全部判断させると迷子になるので、状態をサーバー側で計算して、
 *   その状態に応じた絞った指示だけをプロンプトに反映する。
 */

import type { UIMessage } from "ai";
import { isInternalTrigger } from "./triggers";
import { textOf } from "./ui-message";

/**
 * 9 領域。Faselu の対話で必ずカバーしたい話題。
 */
export const TOPICS = [
  "性格",
  "人間関係",
  "恋愛",
  "価値観",
  "将来像",
  "コンプレックス",
  "ストレス要因",
  "他人への違和感",
  "自分のこだわり",
] as const;

export type Topic = (typeof TOPICS)[number];

/**
 * 対話のフェーズ。サーバーがメッセージ履歴から推論する。
 *
 * - opening: 対話開始直後（0 AI ターン）
 * - collecting: 通常の素材集め。現在の領域について継続して掘り下げる
 * - transitioning: 直近 3 ターン以上同じ領域だった → 別の未踏領域へ転換が必要
 * - wrapping: 12 ターン超え。未踏領域を駆け足でカバー中
 * - ready_to_final: 9 領域カバー済み or 15 ターン超え。<<READY_FOR_FINAL>> を出す
 */
export type DialoguePhase =
  | "opening"
  | "collecting"
  | "transitioning"
  | "wrapping"
  | "ready_to_final";

/**
 * フェーズと領域カバー状態のスナップショット。プロンプト生成の入力になる。
 */
export type DialogueContext = {
  phase: DialoguePhase;
  /** AI ターンの総数（opening 除く） */
  aiTurnCount: number;
  /** ユーザーが送ったターン数（内部トリガは除外） */
  userTurnCount: number;
  /** 既に触れたユニーク領域 */
  coveredTopics: Topic[];
  /** まだ触れていない領域 */
  uncoveredTopics: Topic[];
  /** 直近 AI ターンの領域。次のターンの「現在の領域」候補 */
  currentTopic: Topic | null;
  /** 直近何ターン同じ領域が続いているか */
  sameTopicStreak: number;
};

/**
 * <<TOPIC:〜>> 形式のタグを応答末尾から抽出する。
 * タグ自体はフロント表示時に剥がされるが、履歴の text には残る設計。
 */
const TOPIC_TAG_RE = /<<TOPIC:([^>]+)>>/;

function extractTopic(text: string): Topic | null {
  const match = text.match(TOPIC_TAG_RE);
  if (!match) return null;
  const candidate = match[1].trim();
  if ((TOPICS as readonly string[]).includes(candidate)) {
    return candidate as Topic;
  }
  // タグの値が想定外（モデルが勝手な領域名を書いた）場合はキーワード救済
  return inferTopicByKeywords(text);
}

/**
 * タグが付いていない or 不正だった場合の救済。キーワードで領域を推測する。
 */
function inferTopicByKeywords(text: string): Topic | null {
  const rules: Array<[Topic, RegExp]> = [
    ["恋愛", /恋愛|恋人|彼氏|彼女|付き合|デート|結婚|好きな人/],
    ["人間関係", /人間関係|友人|友達|家族|親|兄弟|職場の人|同僚|上司/],
    ["コンプレックス", /コンプレックス|劣等|弱点|苦手|嫌い(な)?自分|無能/],
    ["ストレス要因", /ストレス|疲れ|プレッシャー|消耗|限界/],
    ["将来像", /将来|これから|目標|なりたい|十年後|二十年後|今後/],
    ["価値観", /価値観|大事にしている|大切なこと|信じている|信念/],
    ["他人への違和感", /違和感|苦手な人|嫌な人|許せない|腹が立つ/],
    ["自分のこだわり", /こだわり|譲れない|妥協できない|聖域|大事にしてる/],
    ["性格", /性格|自分の癖|自分の特徴|どんな人/],
  ];
  for (const [topic, re] of rules) {
    if (re.test(text)) return topic;
  }
  return null;
}

type TurnInfo = { topic: Topic | null };

function extractTurnInfos(messages: UIMessage[]): TurnInfo[] {
  const infos: TurnInfo[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.id === "opening") continue;
    const text = textOf(m);
    if (!text) continue;
    let topic = extractTopic(text);
    if (!topic) {
      // タグがない場合、直前のユーザー発言と AI 応答の両方からキーワード推論
      const prevUserText =
        i > 0 && messages[i - 1]?.role === "user"
          ? textOf(messages[i - 1])
          : "";
      topic = inferTopicByKeywords(`${prevUserText}\n${text}`);
    }
    infos.push({ topic });
  }
  return infos;
}

export function inferDialogueContext(messages: UIMessage[]): DialogueContext {
  const infos = extractTurnInfos(messages);
  const aiTurnCount = infos.length;

  // ユーザーターン数（内部トリガを除外）
  const userTurnCount = messages.filter(
    (m) => m.role === "user" && !isInternalTrigger(textOf(m)),
  ).length;

  // 領域カバー集計
  const coveredSet = new Set<Topic>();
  for (const info of infos) {
    if (info.topic) coveredSet.add(info.topic);
  }
  const coveredTopics = TOPICS.filter((t) => coveredSet.has(t));
  const uncoveredTopics = TOPICS.filter((t) => !coveredSet.has(t));

  // 現在の領域と連続ターン数
  const currentTopic = infos[infos.length - 1]?.topic ?? null;
  let sameTopicStreak = 0;
  if (currentTopic) {
    for (let i = infos.length - 1; i >= 0; i--) {
      if (infos[i].topic === currentTopic) sameTopicStreak++;
      else break;
    }
  }

  // フェーズ判定
  let phase: DialoguePhase;
  if (aiTurnCount === 0) {
    phase = "opening";
  } else if (
    uncoveredTopics.length === 0 ||
    aiTurnCount >= 15 ||
    userTurnCount >= 15
  ) {
    phase = "ready_to_final";
  } else if (aiTurnCount >= 12) {
    phase = "wrapping";
  } else if (sameTopicStreak >= 3 && uncoveredTopics.length > 0) {
    phase = "transitioning";
  } else {
    phase = "collecting";
  }

  return {
    phase,
    aiTurnCount,
    userTurnCount,
    coveredTopics,
    uncoveredTopics,
    currentTopic,
    sameTopicStreak,
  };
}

/**
 * AI 応答のテキストから領域タグ <<TOPIC:〜>> を取り除いたものを返す。
 * フロント表示用の clean text を作るときに使う。
 */
export function stripTopicTag(text: string): string {
  return text.replace(TOPIC_TAG_RE, "").trimEnd();
}

/**
 * 対話フェーズに応じた追加指示を組み立てる。
 * これを DIALOGUE_BASE の末尾に連結して、AI に「いまこのターンで何をすべきか」を
 * 明確に伝える。
 */
export function buildDialoguePhaseInstruction(ctx: DialogueContext): string {
  const listTopics = (topics: readonly Topic[]) =>
    topics.length > 0 ? topics.join(" / ") : "（残りなし）";

  const coverage = `カバー済み領域: ${listTopics(ctx.coveredTopics)}\n未踏領域: ${listTopics(ctx.uncoveredTopics)}\n現在の領域: ${ctx.currentTopic ?? "未確定"}\n同領域連続ターン: ${ctx.sameTopicStreak}\nAI ターン総数: ${ctx.aiTurnCount}\nユーザー発言数: ${ctx.userTurnCount}`;

  switch (ctx.phase) {
    case "opening":
      return `# 現在のフェーズ: 対話の冒頭

これが最初のターン。メタな前置きは一切付けず、いきなり最初の問いから始める。

最初の問いは「性格」領域から、ユーザーが具体的なエピソードを語らざるを得ない形で投げる。例えば「自分の性格を象徴するような最近の出来事を 1 つ思い出して、その時の状況と、その時感じたことを教えてください」のような形。

応答末尾に \`<<TOPIC:性格>>\` を必ず付ける。`;

    case "collecting":
      return `# 現在のフェーズ: 素材集め（通常深掘り）

${coverage}

このターンの方針：

- 現在の領域「${ctx.currentTopic ?? "（未確定）"}」を、ユーザーの直前の応答に足りない要素（エピソード / 感情 / 思考 / 行動）を 1 つだけ補う問いで深める。
- 同じ領域はあと最大 ${Math.max(0, 3 - ctx.sameTopicStreak)} ターン継続できる。それを超えたら別の領域に転換すべき。
- ユーザーが既に答えた内容を、別の言葉で聞き直さない。新しい情報を引き出す問いだけ投げる。
- 応答末尾に \`<<TOPIC:領域名>>\` を必ず付ける。`;

    case "transitioning":
      return `# 現在のフェーズ: 領域転換

${coverage}

このターンは **必ず別の未踏領域へ転換する**。現在の領域「${ctx.currentTopic ?? "（未確定）"}」は 3 ターン以上続いていて、これ以上続けない。

転換手順：

1. 直前のユーザー発言に対して、ごく短い受け止め（10〜20 字）を一つ置く。
2. 「では別のことを伺いたいのですが」「次は〜について聞かせてください」のような自然な前置きで領域転換を宣言する。
3. 未踏領域 [${listTopics(ctx.uncoveredTopics)}] の中から 1 つ選び、その領域の導入の問いを投げる。
4. 応答末尾に \`<<TOPIC:選んだ領域名>>\` を必ず付ける。

未踏領域は対話の流れに合うものを優先する。具体的な例は以下：

- 恋愛: 「これまでの恋愛で印象に残っているエピソードを 1 つ教えてください」
- コンプレックス: 「自分のここが嫌だ、と感じている部分があれば、その背景も含めて教えてください」
- ストレス要因: 「最近ストレスを感じた具体的な場面を 1 つ思い出して、その時何が起きていたか教えてください」
- 将来像: 「数年後、自分がどんな状態でいたいか、思い浮かべている像があれば教えてください」
- 価値観: 「あなたが大事にしている考え方や、譲りたくない感覚を、最近それを意識した場面と一緒に教えてください」
- 他人への違和感: 「最近、誰かの言動に違和感を覚えた場面を思い出して、その時の状況と感じたことを教えてください」
- 自分のこだわり: 「自分はこういうところが他の人と違う、と感じている部分を、それが表れた場面と一緒に教えてください」
- 人間関係: 「家族や友人との関係で、最近気になっていることがあれば、具体的な場面と一緒に教えてください」`;

    case "wrapping":
      return `# 現在のフェーズ: 最終分析前の仕上げ（駆け足カバー）

${coverage}

対話が ${ctx.aiTurnCount} ターン進んだ。残り未踏領域 [${listTopics(ctx.uncoveredTopics)}] を駆け足で 1〜2 ターンずつ触れて、最終分析モードへ進む準備をする。

このターンの方針：

1. 直前のユーザー発言にごく短い受け止めを返す。
2. 未踏領域から 1 つ選び、その領域の導入の問いを投げる。深く掘り下げすぎず、エピソードや感覚を一つ引き出す程度で十分。
3. 応答末尾に \`<<TOPIC:選んだ領域名>>\` を必ず付ける。

未踏領域がすべて埋まったら、次のターンで READY_FOR_FINAL に移行することを意識する。`;

    case "ready_to_final":
      return `# 現在のフェーズ: 最終分析へ移行

${coverage}

ここまでで十分に素材が集まった。このターンは **\`<<READY_FOR_FINAL>>\` というトークンだけを単独で出力する**。

- 前置き・改行後の本文・領域タグも含めて、これ以外のテキストを 1 文字も書かない。
- ユーザーへの慰めや誘導文は書かない。フロント側が画面で表示する。

このトークンを出力すると、フロント側がそれを検知してから最終分析モード（詳細レポート出力）の指示を改めて送ってくる。`;
  }
}
