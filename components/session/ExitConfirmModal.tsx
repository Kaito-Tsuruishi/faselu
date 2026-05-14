type Props = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function ExitConfirmModal({ onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center px-6 safe-pad"
      style={{ backgroundColor: "rgba(10, 10, 12, 0.85)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-[24px] p-10 max-w-[420px] w-full"
        style={{
          backgroundColor: "rgba(20, 20, 24, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="font-serif-jp text-[15px] leading-[2] mb-8"
          style={{ color: "var(--color-ink-text)" }}
        >
          ここで止めると、ここまでの会話は破棄され、
          <br />
          分析結果も発行されません。
          <br />
          本当にやめますか？
        </p>
        <div className="flex gap-6 items-center">
          <button
            type="button"
            onClick={onConfirm}
            className="tap-target font-serif-jp text-[13px] gold-underline pb-[2px]"
            style={{ color: "var(--color-ink-text)" }}
          >
            止める
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="tap-target font-serif-jp text-[13px]"
            style={{ color: "var(--color-muted-1)" }}
          >
            続ける
          </button>
        </div>
      </div>
    </div>
  );
}
