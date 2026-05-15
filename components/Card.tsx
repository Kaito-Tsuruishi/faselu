import type { CardData } from "@/lib/types";

function buildGradient(color: CardData["card_color"]): string {
  const { gradient_type, direction, colors, stops } = color;
  if (!colors || colors.length === 0) return "#1a1a1a";
  if (colors.length === 1) return colors[0];
  // stops が colors と同じ長さで、すべて 0〜100 の範囲なら位置指定として使う。
  const validStops =
    Array.isArray(stops) &&
    stops.length === colors.length &&
    stops.every((s) => typeof s === "number" && s >= 0 && s <= 100);
  const stopsStr = colors
    .map((c, i) => (validStops ? `${c} ${stops![i]}%` : c))
    .join(", ");
  switch (gradient_type) {
    case "radial":
      return `radial-gradient(${direction}, ${stopsStr})`;
    case "conic":
      return `conic-gradient(${direction}, ${stopsStr})`;
    case "linear":
    default:
      return `linear-gradient(${direction}, ${stopsStr})`;
  }
}

/**
 * カード見出し (FASELU / CHARACTERISTICS / QUESTION TO SELF) に
 * 本人色のグラデを「文字塗り」として当てるための style。
 * 旧 .gold-text の本人色版。
 */
function accentTextStyle(color: CardData["card_color"]): React.CSSProperties {
  const first = color.colors[0] ?? "#a8b87a";
  const second = color.colors[1] ?? first;
  return {
    background: `linear-gradient(135deg, ${first} 0%, ${second} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
}

/**
 * カードの QUESTION TO SELF 枠を本人色グラデの 1px 枠取りにする style。
 * 旧 .gold-border の本人色版。
 */
function accentBorderStyle(
  color: CardData["card_color"],
): React.CSSProperties {
  const first = color.colors[0] ?? "#a8b87a";
  const second = color.colors[1] ?? first;
  return {
    background: `linear-gradient(135deg, ${first}, ${second})`,
    WebkitMask:
      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
    padding: "1px",
  };
}

/**
 * 文字数に応じてフォントサイズを線形に縮小する。
 * 短いほど大きく、長いほど小さく。
 */
function scaleFontSize(
  length: number,
  shortLen: number,
  longLen: number,
  shortPx: number,
  longPx: number,
): number {
  if (length <= shortLen) return shortPx;
  if (length >= longLen) return longPx;
  const t = (length - shortLen) / (longLen - shortLen);
  return Math.round(shortPx + (longPx - shortPx) * t);
}

type Props = {
  data: CardData;
  date?: string;
  ref?: React.Ref<HTMLDivElement>;
};

export function Card({ data, date, ref }: Props) {
  const displayDate =
    date ??
    new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const keyPhraseFontPx = scaleFontSize(data.key_phrase.length, 25, 60, 19, 14);

  const maxCharLen = Math.max(...data.characteristics.map((c) => c.length), 1);
  const characteristicsFontPx = scaleFontSize(maxCharLen, 25, 45, 13, 11);

  const questionFontPx = scaleFontSize(
    data.question_to_self.length,
    40,
    100,
    13,
    11,
  );

  return (
    <div
      ref={ref}
      className="rounded-[28px] p-[22px] w-[420px] h-[560px]"
      style={{
        background: buildGradient(data.card_color),
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="paper-dark font-serif-jp rounded-[12px] w-full h-full p-[28px_24px] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between mb-[6px]">
          <div
            className="text-[10px] tracking-[0.15em]"
            style={{
              color: "var(--color-muted-2)",
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
            }}
          >
            {displayDate}
          </div>
          <div
            className="text-[12px] tracking-[0.3em] font-bold"
            style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
              ...accentTextStyle(data.card_color),
            }}
          >
            FASELU
          </div>
        </div>
        <div
          className="text-[12px] tracking-[0.25em] mb-[18px]"
          style={{
            color: "var(--color-muted-1)",
            fontFamily: "var(--font-noto-sans-jp), sans-serif",
          }}
        >
          あなたという人間
        </div>

        <div className="mb-[18px]">
          <div
            className="w-[120px] h-[3px] rounded-[2px] mb-[12px]"
            style={{
              // 枠と同じグラデを横方向で塗る (全色 + stops を使う)
              background: buildGradient({
                ...data.card_color,
                gradient_type: "linear",
                direction: "90deg",
              }),
            }}
          />
          <div
            className="leading-[1.7] font-medium"
            style={{
              color: "#f0ece4",
              letterSpacing: "0.02em",
              fontSize: `${keyPhraseFontPx}px`,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {data.key_phrase}
          </div>
        </div>

        <hr
          className="border-0 my-[14px]"
          style={{
            borderTop: "1px dashed var(--color-line-on-dark)",
          }}
        />

        <div
          className="text-[9px] tracking-[0.2em] font-bold mb-[8px]"
          style={{
            fontFamily: "var(--font-noto-sans-jp), sans-serif",
            ...accentTextStyle(data.card_color),
          }}
        >
          CHARACTERISTICS
        </div>
        <ul className="list-none p-0 m-0 mb-4">
          {data.characteristics.map((c, i) => (
            <li
              key={i}
              className="leading-[1.6] mb-[6px] pl-[1em] relative"
              style={{
                color: "var(--color-ink-text-soft)",
                fontSize: `${characteristicsFontPx}px`,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              <span
                className="absolute left-0 top-[8px] text-[6px]"
                style={{ color: "var(--color-accent-vermilion)" }}
              >
                ●
              </span>
              {c}
            </li>
          ))}
        </ul>

        <div
          className="mt-auto p-[14px_16px] rounded-[12px] relative"
          style={{
            background: `linear-gradient(135deg, ${data.card_color.colors[0]}1a, ${(data.card_color.colors[1] ?? data.card_color.colors[0])}0d)`,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 rounded-[12px] pointer-events-none"
            style={accentBorderStyle(data.card_color)}
          />
          <div
            className="text-[9px] tracking-[0.2em] font-bold mb-[6px] relative"
            style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
              ...accentTextStyle(data.card_color),
            }}
          >
            QUESTION TO SELF
          </div>
          <div
            className="leading-[1.7] relative"
            style={{
              color: "var(--color-ink-text)",
              fontSize: `${questionFontPx}px`,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {data.question_to_self}
          </div>
        </div>
      </div>
    </div>
  );
}
