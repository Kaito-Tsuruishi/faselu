import type { CardData } from "@/lib/types";

/**
 * カード用の CSS gradient 文字列を組み立てる。
 *
 * AI が指定する stops の解釈:
 *   AI 側の意味は「色 i は stops[i] から stops[i+1] までを視覚的に占有する」
 *   つまり stops は「色の境界線」を表す。CSS の純度 100% 位置とは違うので、
 *   このレンダラで CSS 用に変換する。
 *
 * 変換方針 (各色の占有区間内で純度 100% を保ち、境界の近くだけで遷移):
 *   入力  colors=[A,B,C],  stops=[0, 65, 85]
 *   意図  A: 0-65% 占有, B: 65-85% 占有, C: 85-100% 占有
 *   出力 CSS:
 *     colors=[A, A, B, B, C, C]
 *     stops =[0, 60, 70, 80, 90, 100]
 *     ↑ 境界 (65) の両側 ±TRANSITION_HALF=5% で遷移、それ以外は純度 100%
 *
 * 末尾の stops が 100 でなくても OK (末色を狭くしたい指示として扱う)。
 * 4 色まで同じ仕組みで対応する。
 *
 * 遷移幅は固定 (TRANSITION_HALF). 揺らぎ・矛盾型を表現したい場合は
 * gradient_type を radial / conic にするか、AI に近接する stops を
 * 指定させる (例: stops=[0, 50, 60] で境界が狭くなり混色帯が広がる)。
 */
const TRANSITION_HALF = 5;

/**
 * scatter モード: colors を scatter_points の位置から滲ませて、絵画的に
 * 混色させるグラデーション。同じ色の組でも、点の配置で全く違う一枚絵に
 * なる。「分類されないあなた」を視覚的に最大化するためのモード。
 *
 * 各点は radial-gradient で「指定位置から指定半径まで色が出て、その先は
 * 透明」に変換される。複数のレイヤーを重ねることで、点と点の間が自然に
 * 混色する。最後に背景色（colors[0]）でフォールバックを敷いて、点が
 * カバーしきれない領域も色が抜けないようにする。
 */
function buildScatterBackground(
  colors: string[],
  points: NonNullable<CardData["card_color"]["scatter_points"]>,
): string {
  const layers = points.map((p) => {
    const color = colors[p.color_index] ?? colors[0];
    return `radial-gradient(circle at ${p.x}% ${p.y}%, ${color} 0%, transparent ${p.radius}%)`;
  });
  // 最後に主色のベタ塗りを敷いて、点の隙間が透明にならないようにする
  const baseColor = colors[0] ?? "#1a1a1a";
  return `${layers.join(", ")}, ${baseColor}`;
}

/**
 * scatter モードのときの、キーフレーズ下の横バー用 linear gradient を組み立てる。
 * scatter_points の各色の出現数を重みにして、その比率を stops に反映する。
 * これで外枠（scatter）とバーの色配分が見た目で揃う。
 */
function buildBarFromScatter(color: CardData["card_color"]): string {
  const { colors, scatter_points } = color;
  if (!scatter_points || scatter_points.length === 0) {
    return colors[0] ?? "#1a1a1a";
  }

  // 各色の出現数を集計
  const counts = colors.map(
    (_, i) => scatter_points.filter((p) => p.color_index === i).length,
  );
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return colors[0] ?? "#1a1a1a";

  // 出現比率を累積パーセントに変換して stops を作る
  // colors[0] が 60% / colors[1] が 30% / colors[2] が 10% なら
  // → stops = [0, 60, 90]（buildGradient と同じ「境界」解釈）
  const stops: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) continue;
    stops.push(Math.round(cumulative));
    cumulative += (counts[i] / total) * 100;
  }
  const activeColors = colors.filter((_, i) => counts[i] > 0);

  return buildGradient({
    colors: activeColors,
    stops,
    gradient_type: "linear",
    direction: "90deg",
    reason: "",
  });
}

function buildGradient(color: CardData["card_color"]): string {
  const { gradient_type, direction, colors, stops, scatter_points } = color;
  if (!colors || colors.length === 0) return "#1a1a1a";
  if (colors.length === 1) return colors[0];

  // scatter モード: scatter_points が有効なら絵画的混色を組み立てる
  if (
    gradient_type === "scatter" &&
    Array.isArray(scatter_points) &&
    scatter_points.length > 0 &&
    scatter_points.every(
      (p) =>
        typeof p?.color_index === "number" &&
        p.color_index >= 0 &&
        p.color_index < colors.length &&
        typeof p?.x === "number" &&
        typeof p?.y === "number" &&
        typeof p?.radius === "number",
    )
  ) {
    return buildScatterBackground(colors, scatter_points);
  }

  const hasValidStops =
    Array.isArray(stops) &&
    stops.length === colors.length &&
    stops.every((s) => typeof s === "number" && s >= 0 && s <= 100);

  const effectiveColors: string[] = [];
  const effectiveStops: number[] = [];

  if (hasValidStops) {
    const boundaries = stops as number[]; // AI 指定の「色の境界」

    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      const startBoundary = boundaries[i];
      const endBoundary = boundaries[i + 1] ?? 100;

      // 色 i の純度 100% 領域: startBoundary + TRANSITION_HALF 〜 endBoundary - TRANSITION_HALF
      // ただし最初の色は 0 から始め、最後の色は 100 で終える。
      const isFirst = i === 0;
      const isLast = i === colors.length - 1;

      const pureStart = isFirst
        ? startBoundary
        : Math.min(startBoundary + TRANSITION_HALF, endBoundary);
      const pureEnd = isLast
        ? 100
        : Math.max(endBoundary - TRANSITION_HALF, pureStart);

      effectiveColors.push(color);
      effectiveStops.push(pureStart);
      if (pureEnd > pureStart) {
        effectiveColors.push(color);
        effectiveStops.push(pureEnd);
      }
    }
  } else {
    effectiveColors.push(...colors);
  }

  const stopsStr = effectiveColors
    .map((c, i) => (hasValidStops ? `${c} ${effectiveStops[i]}%` : c))
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
 *
 * 文字単体だと scatter モードで暗い背景の上に来た時にグラデ塗りが見えづらく
 * なるので、AccentText コンポーネントで「白文字を下敷きに、上に色グラデ文字
 * を重ねる」二重構造で描画する（縁取り感を出して読みやすさを確保）。
 * この style はその「上のレイヤー」用。
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
 * 文字を「白い縁取り（下敷き）+ 色グラデ塗り（上）」の二重構造で描画する。
 * scatter モードのカードのように、文字の背後に暗色が来うる場合でも、白の
 * 縁が文字を浮かび上がらせるので可読性が保てる。
 *
 * 実装: 同じテキストを 2 つの span で重ねる。下の span は白で text-shadow
 * によるごく薄い縁取り風表現、上の span は色グラデ塗り（accentTextStyle）。
 * position: relative + absolute で完全に重ねる。
 */
function AccentText({
  children,
  color,
  className,
  style,
}: {
  children: React.ReactNode;
  color: CardData["card_color"];
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block", ...style }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          // 下敷き文字をクリーム色（紙質感に合う暖色系オフホワイト）にして、
          // 上に乗る色グラデを邪魔せず、暗色背景でも文字が浮き上がるように。
          // text-shadow で 4 方向に細い縁取りを敷くことで、上の色文字の周囲
          // にごく細いクリームの輪郭が出る。
          color: "#fbf6e6",
          textShadow:
            "0.3px 0 0 #fbf6e6, -0.3px 0 0 #fbf6e6, 0 0.3px 0 #fbf6e6, 0 -0.3px 0 #fbf6e6",
        }}
      >
        {children}
      </span>
      <span style={{ position: "relative", ...accentTextStyle(color) }}>
        {children}
      </span>
    </span>
  );
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
      className="rounded-[28px] p-[22px] w-[420px] min-h-[560px]"
      style={{
        background: buildGradient(data.card_color),
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="paper-dark font-serif-jp rounded-[12px] w-full min-h-[516px] p-[28px_24px] flex flex-col">
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
          <AccentText
            color={data.card_color}
            className="text-[12px] tracking-[0.3em] font-bold"
            style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
            }}
          >
            FASELU
          </AccentText>
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
              // 枠の色配分を横方向の linear で塗る。
              // scatter モードのときは scatter_points の各色の出現数を比率に
              // 変換してバーに反映する。linear モードのときは stops をそのまま使う。
              background:
                data.card_color.gradient_type === "scatter"
                  ? buildBarFromScatter(data.card_color)
                  : buildGradient({
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

        <AccentText
          color={data.card_color}
          className="text-[9px] tracking-[0.2em] font-bold mb-[8px] block"
          style={{
            fontFamily: "var(--font-noto-sans-jp), sans-serif",
          }}
        >
          CHARACTERISTICS
        </AccentText>
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
          <AccentText
            color={data.card_color}
            className="text-[9px] tracking-[0.2em] font-bold mb-[6px] relative block"
            style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
            }}
          >
            QUESTION TO SELF
          </AccentText>
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
