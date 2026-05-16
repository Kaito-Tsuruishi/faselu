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
 * 7 領域。Faselu の対話で必ずカバーしたい話題。
 *
 * 旧 9 領域から「他人への違和感」「自分のこだわり」を統合した。それぞれ
 * 人間関係 / 価値観 の中で自然に語られる素材として吸収し、領域カバーが
 * 完了しやすい設計にしている。
 */
export const TOPICS = [
  "性格",
  "人間関係",
  "恋愛",
  "価値観",
  "将来像",
  "コンプレックス",
  "ストレス要因",
] as const;

export type Topic = (typeof TOPICS)[number];

/**
 * 1 領域あたりの最大ターン数（しつこさのロック）。
 * 連続ではなく「合計」で数える。同じ領域に出入りを繰り返しても、
 * 累計で 3 回触れたらその領域は打ち止め扱い。
 */
const MAX_TURNS_PER_TOPIC = 3;

/**
 * 未踏領域がこの個数以下になったら wrapping フェーズに入る。
 * 残りを 1 ターンずつ駆け足で消化するモードへ切り替える目安。
 */
const WRAPPING_UNCOVERED_THRESHOLD = 3;

/**
 * 対話のフェーズ。サーバーがメッセージ履歴から推論する。
 *
 * - opening: 対話開始直後（0 AI ターン）
 * - collecting: 通常の素材集め。現在の領域について継続して掘り下げる
 * - transitioning: 現在の領域が打ち止め（合計 3 回触れた）→ 別の未踏領域へ転換
 * - wrapping: 未踏領域が残り少ない → 駆け足でカバー中
 * - ready_to_final: 全領域カバー済み → <<READY_FOR_FINAL>> を出す
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
  /** 直近 AI ターンの主領域（タグの先頭）。次のターンの「現在の領域」候補 */
  currentTopic: Topic | null;
  /** 現在の領域に累計で何回触れたか（連続ではなく合計） */
  currentTopicTotalTurns: number;
  /** 現在の領域がこれ以上続けられるか（false なら次は転換必須） */
  currentTopicExhausted: boolean;
};

/**
 * <<TOPIC:〜>> 形式のタグを応答末尾から抽出する。
 * タグ自体はフロント表示時に剥がされるが、履歴の text には残る設計。
 *
 * 値はカンマ区切りで複数領域を許容する（1 ターンで複数領域を同時カバー）。
 * 例: <<TOPIC:人間関係, 他人への違和感>> → ["人間関係"] のみ採用（不正領域は無視）
 */
const TOPIC_TAG_RE = /<<TOPIC:([^>]+)>>/;

function parseTopicTagValue(value: string): Topic[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Topic => (TOPICS as readonly string[]).includes(s));
}

/**
 * AI 応答テキストから 1 ターンが触れた領域配列を取り出す。
 * タグが無い or 全て不正領域だったときは、キーワード救済で 1 領域だけ拾う。
 */
function extractTopics(text: string): Topic[] {
  const match = text.match(TOPIC_TAG_RE);
  if (match) {
    const parsed = parseTopicTagValue(match[1]);
    if (parsed.length > 0) return parsed;
  }
  // タグが無い or 不正だった場合のキーワード救済
  const fallback = inferTopicByKeywords(text);
  return fallback ? [fallback] : [];
}

/**
 * タグが付いていない or 不正だった場合の救済。キーワードで領域を推測する。
 * 統合された旧領域のキーワード（違和感系、こだわり系）も、統合先の領域へ
 * 寄せるように残してある。
 */
function inferTopicByKeywords(text: string): Topic | null {
  const rules: Array<[Topic, RegExp]> = [
    ["恋愛", /恋愛|恋人|彼氏|彼女|付き合|デート|結婚|好きな人/],
    [
      "人間関係",
      /人間関係|友人|友達|家族|親|兄弟|職場の人|同僚|上司|違和感|苦手な人|嫌な人|許せない|腹が立つ/,
    ],
    ["コンプレックス", /コンプレックス|劣等|弱点|苦手|嫌い(な)?自分|無能/],
    ["ストレス要因", /ストレス|疲れ|プレッシャー|消耗|限界/],
    ["将来像", /将来|これから|目標|なりたい|十年後|二十年後|今後/],
    [
      "価値観",
      /価値観|大事にしている|大切なこと|信じている|信念|こだわり|譲れない|妥協できない|聖域|大事にしてる/,
    ],
    ["性格", /性格|自分の癖|自分の特徴|どんな人/],
  ];
  for (const [topic, re] of rules) {
    if (re.test(text)) return topic;
  }
  return null;
}

type TurnInfo = {
  /** このターンで触れた領域（複数可、タグ先頭が主領域） */
  topics: Topic[];
};

function extractTurnInfos(messages: UIMessage[]): TurnInfo[] {
  const infos: TurnInfo[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.id === "opening") continue;
    const text = textOf(m);
    if (!text) continue;
    let topics = extractTopics(text);
    if (topics.length === 0) {
      // タグも無く救済もできなかった → 直前ユーザー発言と合わせて再救済
      const prevUserText =
        i > 0 && messages[i - 1]?.role === "user"
          ? textOf(messages[i - 1])
          : "";
      const fallback = inferTopicByKeywords(`${prevUserText}\n${text}`);
      topics = fallback ? [fallback] : [];
    }
    infos.push({ topics });
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

  // 領域カバー集計（複数タグなら全部 covered に入れる）
  const coveredSet = new Set<Topic>();
  for (const info of infos) {
    for (const t of info.topics) coveredSet.add(t);
  }
  const coveredTopics = TOPICS.filter((t) => coveredSet.has(t));
  const uncoveredTopics = TOPICS.filter((t) => !coveredSet.has(t));

  // 現在の領域 = 直近ターンの主領域（タグ先頭）
  const currentTopic = infos[infos.length - 1]?.topics[0] ?? null;

  // 現在の領域に累計で何ターン触れたか。
  // しつこさのロックは「連続」ではなく「合計」で数える。同じ領域に出入り
  // した場合も合算する。主領域だけでなく副領域として並んだ場合もカウントは
  // 主領域のみ（副領域はカバー判定にだけ使う）。
  let currentTopicTotalTurns = 0;
  if (currentTopic) {
    for (const info of infos) {
      if (info.topics[0] === currentTopic) currentTopicTotalTurns++;
    }
  }
  const currentTopicExhausted =
    currentTopic !== null && currentTopicTotalTurns >= MAX_TURNS_PER_TOPIC;

  // フェーズ判定。ターン上限ではなく「領域カバーの達成」で判定する。
  let phase: DialoguePhase;
  if (aiTurnCount === 0) {
    phase = "opening";
  } else if (uncoveredTopics.length === 0) {
    phase = "ready_to_final";
  } else if (currentTopicExhausted && uncoveredTopics.length > 0) {
    phase = "transitioning";
  } else if (uncoveredTopics.length <= WRAPPING_UNCOVERED_THRESHOLD) {
    phase = "wrapping";
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
    currentTopicTotalTurns,
    currentTopicExhausted,
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
    topics.length > 0 ? topics.join(" / ") : "(残りなし)";

  const coverage = `カバー済み領域: ${listTopics(ctx.coveredTopics)}\n未踏領域: ${listTopics(ctx.uncoveredTopics)}\n現在の領域: ${ctx.currentTopic ?? "未確定"}\n現在の領域の累計ターン: ${ctx.currentTopicTotalTurns} / ${MAX_TURNS_PER_TOPIC}\nAI ターン総数: ${ctx.aiTurnCount}\nユーザー発言数: ${ctx.userTurnCount}`;

  switch (ctx.phase) {
    case "opening":
      return `# 現在のフェーズ: 対話の冒頭

これが最初のターン。メタな前置きは一切付けず、いきなり最初の問いから始める。

最初の問いは「性格」領域から、ユーザーが具体的なエピソードを語らざるを得ない形で投げる。例えば「自分の性格を象徴するような最近の出来事を 1 つ思い出して、その時の状況と、その時感じたことを教えてください」のような形。

応答末尾に \`<<TOPIC:性格>>\` を必ず付ける。`;

    case "collecting": {
      // 現在の領域に既に 2 回触れている = これから 3 回目（最後）のターン。
      // ここで「素材揃っていれば領域転換、揃っていなければ踏み込みも可」の
      // 分岐指示を出す。それ以前のターンは通常の深掘り。
      const isFinalTurnForTopic = ctx.currentTopicTotalTurns >= 2;
      const probeInstruction = isFinalTurnForTopic
        ? `

このターンは「現在の領域「${ctx.currentTopic ?? "（未確定）"}」での最後の 1 回」になる可能性が高い。次にどう動くかを以下の優先順で判断する:

1. ここまでの 2 ターンで、エピソード / 感情 / 思考 / 行動 / 選択 の主な要素が揃っていて、これ以上深掘りしても新しい素材が出ない見込みなら、**深追いせず別の未踏領域への転換を選んでよい**。その場合は領域転換手順（短い受け止め → 自然な前置き → 未踏領域から 1 つ選んで導入の問い → タグ更新）を踏む。
2. 揃っていない、もしくは現在の領域で **矛盾・違和感** が観察できる場合（A と非 A を両方言っている、語っている価値観と語られたエピソードがズレている など）は、ここで 1 回だけ指摘してよい。攻撃ではなく観察として、断定せず、自分の読み取り違いの可能性を残す形で。
3. 揃っていないが、ユーザーが **避けている可能性のある痕跡** が観察できる場合（短答で流された / 抽象に逃げた / 質問されていないのに否定形で予防線を張った / 一度言って訂正した）は、当てに行かず、本人が状態を選べる選択肢を渡す形で踏み込む。例えば「整理しきれていない感じか、1 つに絞れない感じか、言葉にしにくい感じか、それともこのまま次に進んで大丈夫な領域か」のように、本人が選べる余地を残す。本人が「次に進んで大丈夫」と答えたらその意思を尊重して領域転換する。
4. それ以外は通常の深掘り問いを置く。

踏み込み（2 または 3）は 1 領域につき 1 回まで。「実は〜なのではないか」「無意識に〜」のような分析や言い当ては最終分析モードの仕事なのでここではしない。`
        : "";

      return `# 現在のフェーズ: 素材集め（通常深掘り）

${coverage}

このターンの方針：

- 現在の領域「${ctx.currentTopic ?? "（未確定）"}」を、ユーザーの直前の応答に足りない要素（エピソード / 感情 / 思考 / 行動）を 1 つだけ補う問いで深める。
- 1 ターンの問いは原則 1 領域に集中する。ユーザーの直前の発言が自然に複数領域に跨る場合のみ、タグに複数領域を並べてよい（例: \`<<TOPIC:人間関係, 価値観>>\`）。効率カバー目的で無理に複数領域を詰め込まない。
- 現在の領域に累計でこれ以上触れられる回数: あと最大 ${Math.max(0, MAX_TURNS_PER_TOPIC - ctx.currentTopicTotalTurns)} 回。これを超えたら別の領域に転換すべき。
- ユーザーが既に答えた内容を、別の言葉で聞き直さない。新しい情報を引き出す問いだけ投げる。
- 応答末尾に \`<<TOPIC:領域名>>\` を必ず付ける（複数領域に跨る場合はカンマ区切り）。${probeInstruction}`;
    }

    case "transitioning":
      return `# 現在のフェーズ: 領域転換

${coverage}

このターンは **必ず別の未踏領域へ転換する**。現在の領域「${ctx.currentTopic ?? "（未確定）"}」は累計 ${ctx.currentTopicTotalTurns} 回触れていて、これ以上続けない。

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
- 人間関係: 「家族や友人との関係で、最近気になっていることや違和感を覚えた場面を、具体的なエピソードと一緒に教えてください」`;

    case "wrapping":
      return `# 現在のフェーズ: 最終分析前の仕上げ（駆け足カバー）

${coverage}

残り未踏領域は [${listTopics(ctx.uncoveredTopics)}] のみ。これらを **1 ターンずつ消化し終えてから ready_to_final へ進む**。

このターンの方針：

1. 直前のユーザー発言にごく短い受け止めを返す。
2. 未踏領域から 1 つ選び、その領域の導入の問いを投げる。深く掘り下げすぎず、エピソードや感覚を 1 つ引き出す程度で十分。同じ領域に 2 回連続で居座らない。
3. 応答末尾に \`<<TOPIC:選んだ領域名>>\` を必ず付ける。

未踏領域がすべて埋まったら、次のターンで READY_FOR_FINAL に移行する。`;

    case "ready_to_final":
      return `# 現在のフェーズ: 最終分析へ移行

${coverage}

ここまでで十分に素材が集まった。このターンは **\`<<READY_FOR_FINAL>>\` というトークンだけを単独で出力する**。

- 前置き・改行後の本文・領域タグも含めて、これ以外のテキストを 1 文字も書かない。
- ユーザーへの慰めや誘導文は書かない。フロント側が画面で表示する。

このトークンを出力すると、フロント側がそれを検知してから最終分析モード（詳細レポート出力）の指示を改めて送ってくる。`;
  }
}
