type Props = {
  onConfirm: () => void;
};

export function ConfirmOverlay({ onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center px-6 safe-pad"
      style={{ backgroundColor: "var(--color-ink-bg)" }}
    >
      <div className="text-center">
        <div
          className="text-[11px] tracking-[0.3em] gold-text font-bold mb-8"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          ANALYSIS COMPLETE
        </div>
        <p
          className="font-serif-jp text-[18px] leading-[2.1] mb-12"
          style={{ color: "var(--color-ink-text)" }}
        >
          分析が終わりました。
          <br />
          結果を確認しますか？
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="tap-target font-serif-jp text-[16px] tracking-[0.15em] gold-underline pb-[4px]"
          style={{ color: "var(--color-ink-text)" }}
        >
          結果を見る
        </button>
      </div>
    </div>
  );
}
