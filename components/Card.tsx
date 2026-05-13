import type { CardData } from "@/lib/types";

function buildGradient(color: CardData["card_color"]): string {
  const { gradient_type, direction, colors } = color;
  if (!colors || colors.length === 0) return "#1a1a1a";
  if (colors.length === 1) return colors[0];
  const stops = colors.join(", ");
  switch (gradient_type) {
    case "radial":
      return `radial-gradient(${direction}, ${stops})`;
    case "conic":
      return `conic-gradient(${direction}, ${stops})`;
    case "linear":
    default:
      return `linear-gradient(${direction}, ${stops})`;
  }
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
        <div
          className="text-[10px] tracking-[0.15em] mb-[6px]"
          style={{
            color: "var(--color-muted-2)",
            fontFamily: "var(--font-noto-sans-jp), sans-serif",
          }}
        >
          {displayDate}
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
            className="w-[28px] h-[3px] rounded-[2px] mb-[12px]"
            style={{
              background: `linear-gradient(90deg, ${data.card_color.colors[0]}, ${data.card_color.colors[1] ?? data.card_color.colors[0]})`,
            }}
          />
          <div
            className="text-[17px] leading-[1.7] font-medium"
            style={{ color: "#f0ece4", letterSpacing: "0.02em" }}
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
          className="text-[9px] tracking-[0.2em] gold-text font-bold mb-[8px]"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          CHARACTERISTICS
        </div>
        <ul className="list-none p-0 m-0 mb-4">
          {data.characteristics.map((c, i) => (
            <li
              key={i}
              className="text-[13px] leading-[1.6] mb-[6px] pl-[1em] relative"
              style={{ color: "var(--color-ink-text-soft)" }}
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
          className="mt-auto p-[14px_16px] rounded-[12px] relative gold-border"
          style={{
            background:
              "linear-gradient(135deg, rgba(212, 175, 106, 0.08), rgba(240, 216, 148, 0.05))",
          }}
        >
          <div
            className="text-[9px] tracking-[0.2em] gold-text font-bold mb-[6px]"
            style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
          >
            QUESTION TO SELF
          </div>
          <div
            className="text-[13px] leading-[1.7]"
            style={{ color: "var(--color-ink-text)" }}
          >
            {data.question_to_self}
          </div>
        </div>
      </div>
    </div>
  );
}
