type Props = {
  onClick: () => void;
  hasNetworkError: boolean;
  /** AI 応答が 1 度も届いていない状態。最初の問いを取り損ねたケース */
  isInitial?: boolean;
};

export function ContinueButton({
  onClick,
  hasNetworkError,
  isInitial = false,
}: Props) {
  const label = isInitial ? "最初の問いをもう一度" : "続きを表示";
  const note = isInitial
    ? "最初の問いがうまく届きませんでした。"
    : hasNetworkError
      ? "途中で通信が切れました。"
      : "応答が途切れたようです。";
  return (
    <div className="self-start mt-1 fade-in">
      <button
        type="button"
        onClick={onClick}
        className="tap-target font-serif-jp text-[13px] gold-underline pb-[2px]"
        style={{ color: "var(--color-ink-text)" }}
      >
        {label}
      </button>
      <p className="mt-2 text-[11px]" style={{ color: "var(--color-muted-3)" }}>
        {note}
      </p>
    </div>
  );
}
