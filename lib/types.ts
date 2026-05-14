export type CardColor = {
  colors: string[];
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
