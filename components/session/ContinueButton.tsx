type Props = {
  onClick: () => void;
  hasNetworkError: boolean;
};

export function ContinueButton({ onClick, hasNetworkError }: Props) {
  return (
    <div className="self-start mt-1 fade-in">
      <button
        type="button"
        onClick={onClick}
        className="tap-target font-serif-jp text-[13px] gold-underline pb-[2px]"
        style={{ color: "var(--color-ink-text)" }}
      >
        続きを表示
      </button>
      <p className="mt-2 text-[11px]" style={{ color: "var(--color-muted-3)" }}>
        {hasNetworkError
          ? "途中で通信が切れました。"
          : "応答が途切れたようです。"}
      </p>
    </div>
  );
}
