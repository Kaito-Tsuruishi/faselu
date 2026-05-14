import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  role: "user" | "assistant";
  text: string;
  /** true なら段落をフェードイン演出で表示する。AI 応答ストリーミング中に true。 */
  fade?: boolean;
  ref?: React.Ref<HTMLDivElement>;
};

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function ChatBubble({ role, text, fade = false, ref }: Props) {
  if (role === "assistant") {
    return <AssistantBubble ref={ref} text={text} fade={fade} />;
  }

  return (
    <div
      ref={ref}
      className="rounded-[16px] px-5 py-4 max-w-[80%] sm:max-w-[75%] self-end text-[15px] leading-[1.8]"
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

const PARAGRAPH_FADE_MS = 1500;
const PARAGRAPH_GAP_MS = 500;

function AssistantBubble({
  text,
  fade,
  ref,
}: {
  text: string;
  fade: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const paragraphs = useMemo(() => splitParagraphs(text), [text]);
  // 初回 fade=true で開始したら、その後 ready になっても残段落をフェードで出し切る。
  const startedFadingRef = useRef(fade);
  if (fade) startedFadingRef.current = true;
  const useFade = startedFadingRef.current;

  const lastShownAtRef = useRef<number>(0);
  const [visibleCount, setVisibleCount] = useState(
    useFade ? 0 : paragraphs.length,
  );

  useEffect(() => {
    const total = paragraphs.length;
    if (!useFade) {
      if (visibleCount !== total) setVisibleCount(total);
      return;
    }
    if (total <= visibleCount) {
      if (total < visibleCount) setVisibleCount(total);
      return;
    }
    const now = Date.now();
    const minNextAt =
      lastShownAtRef.current === 0
        ? now
        : lastShownAtRef.current + PARAGRAPH_FADE_MS + PARAGRAPH_GAP_MS;
    const delay = Math.max(0, minNextAt - now);
    const timer = window.setTimeout(() => {
      lastShownAtRef.current = Date.now();
      setVisibleCount((c) => Math.min(c + 1, total));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [paragraphs.length, visibleCount, useFade]);

  return (
    <div
      ref={ref}
      className="font-serif-jp px-1 py-2 self-start text-[16px] leading-[2] max-w-[640px] sm:max-w-[85%]"
      style={{ color: "var(--color-ink-text)" }}
    >
      {paragraphs.slice(0, visibleCount).map((p, i) => (
        <Paragraph
          key={i}
          text={p}
          instant={!useFade}
          marginTop={i === 0 ? 0 : "0.9em"}
        />
      ))}
    </div>
  );
}

function Paragraph({
  text,
  instant,
  marginTop,
}: {
  text: string;
  instant: boolean;
  marginTop: string | number;
}) {
  if (instant) {
    return (
      <p
        style={{
          whiteSpace: "pre-wrap",
          margin: marginTop ? `${marginTop} 0 0 0` : 0,
        }}
      >
        {text}
      </p>
    );
  }
  // 新規段落: CSS animation で確実にフェードイン
  return (
    <p
      className="fade-in-paragraph"
      style={{
        whiteSpace: "pre-wrap",
        margin: marginTop ? `${marginTop} 0 0 0` : 0,
      }}
    >
      {text}
    </p>
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
