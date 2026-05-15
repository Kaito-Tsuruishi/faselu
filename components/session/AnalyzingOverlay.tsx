type Props = {
  fading?: boolean;
};

export function AnalyzingOverlay({ fading = false }: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center px-6 safe-pad"
      style={{
        backgroundColor: "var(--color-ink-bg)",
        opacity: fading ? 0 : 1,
        transition: "opacity 800ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div className="text-center">
        <div
          className="text-[11px] tracking-[0.3em] gold-text font-bold mb-6"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          ANALYZING
        </div>
        <p
          className="font-serif-jp text-[17px] leading-[2.1] mb-10"
          style={{ color: "var(--color-ink-text)" }}
        >
          分析しています。
          <br />
          そのまま待ってください。
        </p>
        <div className="inline-flex gap-[6px] items-center">
          <span
            className="typing-dot inline-block w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
          <span
            className="typing-dot inline-block w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
          <span
            className="typing-dot inline-block w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
