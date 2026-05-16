/**
 * scatter モード（複数の色を複数の位置から滲ませて、絵画的に混色させる
 * パターン）で使う 1 点の指定。
 */
export type ScatterPoint = {
  /** colors 配列のインデックス。どの色をこの点に置くか */
  color_index: number;
  /** 中心の x 座標（0〜100、% 単位） */
  x: number;
  /** 中心の y 座標（0〜100、% 単位） */
  y: number;
  /** 滲みの半径（15〜40、% 単位） */
  radius: number;
};

export type CardColor = {
  colors: string[];
  /** 各 color に対応する 0〜100 の位置。省略時は均等配分。colors と長さが一致しない場合は無視される。 */
  stops?: number[];
  /**
   * "scatter" は colors を scatter_points の位置から滲ませて混色させる
   * モード。同じ色でも配置で全く違うカードになるため、個別性が最大化される。
   * 既存の linear / radial / conic は後方互換のため残しているが、新規生成では
   * 原則 scatter を使う。
   */
  gradient_type: "linear" | "radial" | "conic" | "scatter";
  direction: string;
  reason: string;
  /**
   * scatter モードで使う点の配列。4〜8 個推奨。
   * gradient_type が "scatter" 以外のときは無視される。
   */
  scatter_points?: ScatterPoint[];
};

export type CardData = {
  key_phrase: string;
  characteristics: [string, string, string];
  question_to_self: string;
  card_color: CardColor;
};

export type SessionResult = {
  report: string;
  card: CardData;
};
