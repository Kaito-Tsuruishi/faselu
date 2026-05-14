export function SafetyTerminatedView() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[520px]">
        <p
          className="font-serif-jp text-[16px] leading-[2.1]"
          style={{ color: "var(--color-ink-text)", whiteSpace: "pre-wrap" }}
        >
          ここまで話してくれてありがとう。
          {"\n"}
          ただ、今のあなたが必要としているのは、
          {"\n"}
          このサービスのような踏み込んだ分析ではなく、
          {"\n"}
          信頼できる人や、専門的な支援だと感じました。
          {"\n\n"}
          このセッションはここで終わります。
          {"\n"}
          ここまでの会話は保存されません。
          {"\n\n"}
          どうか、自分を大事にしてください。
        </p>
        <div className="mt-12">
          <a
            href="/"
            className="font-serif-jp inline-flex items-center text-[14px] gold-underline pb-[2px] tap-target"
            style={{ color: "var(--color-ink-text)" }}
          >
            トップへ戻る
          </a>
        </div>
      </div>
    </main>
  );
}
