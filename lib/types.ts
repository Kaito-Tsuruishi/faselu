export type CardColor = {
  colors: string[];
  /** 各 color に対応する 0〜100 の位置。省略時は均等配分。colors と長さが一致しない場合は無視される。 */
  stops?: number[];
  gradient_type: "linear" | "radial" | "conic";
  direction: string;
  reason: string;
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
