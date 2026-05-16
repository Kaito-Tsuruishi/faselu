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
/**
 * 各点の純色領域の比率。radius のうち内側 70% は純色のまま保ち、外側
 * 30% だけ透明に向けてフェードさせる。バーで使う比率と見た目が乖離
 * しないよう、点の中心だけ純色にせず、円としてしっかり色が出る作り。
 */
const SCATTER_PURE_RATIO = 0.7;

type ScatterPoint = NonNullable<
  CardData["card_color"]["scatter_points"]
>[number];

/**
 * AI が指定した scatter_points の (x, y) はカード全体 (0-100) の座標だが、
 * 実際にはカード中央は paper-dark に覆われて見えない。外周 22px の枠
 * だけが scatter 背景の見える領域。
 *
 * AI の意図する面積比が見える領域で正しく表現されるように、各点を
 * 「中心からの距離」に応じて枠領域へ投影する。意図は 3 軸で汲み取る:
 *
 *  - 方角: 元の (x, y) が偏っている方向は、その方向の辺に投影して保持
 *  - 存在感: 元の radius は概ね保持。中央寄り点だけやや控えめにする
 *  - 広がり: 中心点はカード全体に広がる主色として扱い、4 辺へ分散
 *
 * 中心からの距離 d (0〜70.7) で 3 段階に分岐:
 *  - d < 15: 中央寄り。1 点を 4 辺に複製し、radius は元の 0.5 倍
 *  - 15 ≤ d < 30: 中間。最近接 1 辺に投影、radius 0.7 倍
 *      （以前は角に投影していたが、辺の中央部が空になって主色が枠から
 *       消える問題があったため、辺投影に変更）
 *  - d ≥ 30: 縁寄り。最近接 1 辺に投影、radius そのまま
 */
function projectPointsToFrame(points: ScatterPoint[]): ScatterPoint[] {
  const projected: ScatterPoint[] = [];

  const projectToNearestEdge = (
    p: ScatterPoint,
    radius: number,
  ): ScatterPoint => {
    const distTop = p.y;
    const distBottom = 100 - p.y;
    const distLeft = p.x;
    const distRight = 100 - p.x;
    const min = Math.min(distTop, distBottom, distLeft, distRight);
    let nx = p.x;
    let ny = p.y;
    if (min === distTop) ny = 0;
    else if (min === distBottom) ny = 100;
    else if (min === distLeft) nx = 0;
    else nx = 100;
    return { color_index: p.color_index, x: nx, y: ny, radius };
  };

  for (const p of points) {
    const dx = p.x - 50;
    const dy = p.y - 50;
    const d = Math.hypot(dx, dy);

    if (d < 15) {
      // 中央寄り点: 4 辺に複製して全方向に広がりを出す
      const r = Math.max(8, Math.round(p.radius * 0.5));
      projected.push({ color_index: p.color_index, x: p.x, y: 0, radius: r });
      projected.push({ color_index: p.color_index, x: 100, y: p.y, radius: r });
      projected.push({ color_index: p.color_index, x: p.x, y: 100, radius: r });
      projected.push({ color_index: p.color_index, x: 0, y: p.y, radius: r });
      continue;
    }

    if (d < 30) {
      // 中間: 最近接 1 辺に投影、radius を控えめに
      projected.push(
        projectToNearestEdge(p, Math.max(10, Math.round(p.radius * 0.7))),
      );
      continue;
    }

    // 縁寄り: 最近接 1 辺に投影、radius そのまま
    projected.push(projectToNearestEdge(p, p.radius));
  }
  return projected;
}

/**
 * scatter モードの背景を SVG (radialGradient + rect) で描画するための React 要素を返す。
 *
 * CSS の `background: radial-gradient(...), radial-gradient(...), ...` で
 * 描画する旧実装は、html-to-image での canvas キャプチャ時にフェード領域が
 * 潰れて、保存画像で縁の色が失われる問題があった。SVG ベースに切り替える
 * ことで、ブラウザのネイティブ SVG レンダラが正確にラスタライズしてくれる
 * ので、UI 表示と保存画像が完全一致する。
 *
 * 描画は次の順で行う:
 *   1. <rect> で主色 colors[0] のベタ塗り (点の隙間が透明にならないように)
 *   2. <rect fill="url(#g-i)"> を color_index 降順で並べる
 *      (CSS と違って SVG は後に描いた方が前面なので、降順で並べると
 *      最後に主色が描かれ末色が背面…と逆になる。色 index が大きい方を
 *      前面に出したいので、ここでは color_index 昇順で並べて末色を最後に
 *      描く)
 */
function buildScatterSvg(
  colors: string[],
  points: NonNullable<CardData["card_color"]["scatter_points"]>,
): React.ReactElement {
  const framePoints = projectPointsToFrame(points);
  // SVG は後に描いた要素が前面 (z-index 順) なので、末色 (color_index 大) を
  // 後に描くために昇順で並べる。CSS 旧実装は前から後ろへ背面に向かう順序
  // だったが、SVG ではこれが逆になる点に注意。
  const sortedPoints = framePoints
    .slice()
    .sort((a, b) => a.color_index - b.color_index);
  const baseColor = colors[0] ?? "#1a1a1a";
  const pureRatioPct = Math.round(SCATTER_PURE_RATIO * 100);
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {sortedPoints.map((p, i) => {
          const color = colors[p.color_index] ?? baseColor;
          return (
            <radialGradient
              key={i}
              id={`faselu-scatter-${i}`}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r={`${p.radius}%`}
            >
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop
                offset={`${pureRatioPct}%`}
                stopColor={color}
                stopOpacity="1"
              />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          );
        })}
      </defs>
      {/* 主色のベタ塗り (点の隙間が透明にならないように) */}
      <rect width="100" height="100" fill={baseColor} />
      {/* 各点を radialGradient で塗る */}
      {sortedPoints.map((_, i) => (
        <rect
          key={i}
          width="100"
          height="100"
          fill={`url(#faselu-scatter-${i})`}
        />
      ))}
    </svg>
  );
}

/**
 * gradient_type が "scatter" かつ scatter_points が有効かを判定する。
 */
function isScatterMode(color: CardData["card_color"]): boolean {
  const { gradient_type, colors, scatter_points } = color;
  if (gradient_type !== "scatter") return false;
  if (!Array.isArray(scatter_points) || scatter_points.length === 0)
    return false;
  return scatter_points.every(
    (p) =>
      typeof p?.color_index === "number" &&
      p.color_index >= 0 &&
      p.color_index < colors.length &&
      typeof p?.x === "number" &&
      typeof p?.y === "number" &&
      typeof p?.radius === "number",
  );
}

/**
 * scatter モードのときの、キーフレーズ下の横バー用 linear gradient を組み立てる。
 *
 * 各色の重みは「点の radius² の合計」で計算する。これは scatter 背景での実描画
 * 面積に対応するので、バーと枠（scatter 背景）の色配分が視覚的に揃う。
 * radius を無視して「点数」だけで按分すると、AI が radius で意図した量感
 * （小さい点 vs 大きい点）と枠が乖離してしまうため、面積基準を採用している。
 */
function buildBarFromScatter(color: CardData["card_color"]): string {
  const { colors, scatter_points } = color;
  if (!scatter_points || scatter_points.length === 0) {
    return colors[0] ?? "#1a1a1a";
  }

  // 各色の面積（radius² の合計）を集計
  const weights = colors.map((_, i) =>
    scatter_points
      .filter((p) => p.color_index === i)
      .reduce((sum, p) => sum + p.radius * p.radius, 0),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return colors[0] ?? "#1a1a1a";

  // 面積比を累積パーセントに変換して stops を作る
  // colors[0] が 60% / colors[1] が 30% / colors[2] が 10% なら
  // → stops = [0, 60, 90]（buildGradient と同じ「境界」解釈）
  const stops: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] === 0) continue;
    stops.push(Math.round(cumulative));
    cumulative += (weights[i] / total) * 100;
  }
  const activeColors = colors.filter((_, i) => weights[i] > 0);

  return buildGradient({
    colors: activeColors,
    stops,
    gradient_type: "linear",
    direction: "90deg",
    reason: "",
  });
}

function buildGradient(color: CardData["card_color"]): string {
  const { gradient_type, direction, colors, stops } = color;
  if (!colors || colors.length === 0) return "#1a1a1a";
  if (colors.length === 1) return colors[0];

  // scatter モードは SVG で描画するため、CSS 側は主色のベタ塗りだけを返す。
  // 実際の散布点は <svg> オーバーレイで描く (buildScatterSvg を参照)。
  if (isScatterMode(color)) {
    return colors[0] ?? "#1a1a1a";
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
 * 色グラデ塗り文字をクリーム色のピル状ベタの上に乗せて、scatter 背景の
 * いかなる色（特に暗色グラデの 1 色目と本人色グラデの 1 色目が同色域に
 * 来るケース）でも可読性を確保するためのラッパー。
 *
 * 構造: 外側 span がクリームのベタ（padding でピル化）、内側 span が
 * accentTextStyle による色グラデ塗り文字。
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
      style={{
        display: "inline-block",
        backgroundColor: "#fbf6e6",
        padding: "1px 6px",
        borderRadius: "3px",
        ...style,
      }}
    >
      <span style={accentTextStyle(color)}>{children}</span>
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

  const scatter =
    isScatterMode(data.card_color) && data.card_color.scatter_points
      ? buildScatterSvg(data.card_color.colors, data.card_color.scatter_points)
      : null;

  return (
    <div
      ref={ref}
      className="rounded-[28px] p-[22px] w-[420px] min-h-[560px] relative overflow-hidden"
      style={{
        background: buildGradient(data.card_color),
        boxShadow: "var(--shadow-card)",
      }}
    >
      {scatter}
      <div className="paper-dark font-serif-jp rounded-[12px] w-full min-h-[516px] p-[28px_24px] flex flex-col relative">
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
            className="text-[12px] tracking-[0.3em] font-black"
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

        <div className="mb-[8px]">
          <AccentText
            color={data.card_color}
            className="text-[9px] tracking-[0.2em] font-bold"
            style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
            }}
          >
            CHARACTERISTICS
          </AccentText>
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
          <div className="mb-[6px] relative">
            <AccentText
              color={data.card_color}
              className="text-[9px] tracking-[0.2em] font-bold"
              style={{
                fontFamily: "var(--font-noto-sans-jp), sans-serif",
              }}
            >
              QUESTION TO SELF
            </AccentText>
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
