type Props = {
  role: "user" | "assistant";
  text: string;
};

export function ChatBubble({ role, text }: Props) {
  if (role === "assistant") {
    return (
      <div
        className="font-serif-jp px-1 py-2 max-w-[85%] self-start text-[16px] leading-[2]"
        style={{
          color: "var(--color-ink-text)",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div
      className="rounded-[16px] px-5 py-4 max-w-[75%] self-end text-[14px] leading-[1.8]"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "var(--color-ink-text)",
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="px-1 py-2 self-start inline-flex gap-[6px] items-center">
      <span
        className="typing-dot inline-block w-[5px] h-[5px] rounded-full"
        style={{ backgroundColor: "var(--color-ink-text-soft)" }}
      />
      <span
        className="typing-dot inline-block w-[5px] h-[5px] rounded-full"
        style={{ backgroundColor: "var(--color-ink-text-soft)" }}
      />
      <span
        className="typing-dot inline-block w-[5px] h-[5px] rounded-full"
        style={{ backgroundColor: "var(--color-ink-text-soft)" }}
      />
    </div>
  );
}
