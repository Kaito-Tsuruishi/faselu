import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-8 sm:px-16 pt-10 flex items-baseline gap-4">
        <span
          className="text-[13px] tracking-[0.4em] font-bold"
          style={{ color: "var(--color-ink-text)" }}
        >
          FASELU
        </span>
        <span
          className="text-[10px] tracking-[0.2em] gold-text font-bold"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          face yourself
        </span>
      </header>

      <section className="flex-1 flex items-center px-8 sm:px-16">
        <div className="max-w-[640px]">
          <h1
            className="font-serif-jp text-[34px] sm:text-[44px] leading-[1.7] mb-16"
            style={{ color: "var(--color-ink-text)" }}
          >
            自分と向き合う、
            <br />
            30 分。
          </h1>

          <p
            className="font-serif-jp text-[15px] sm:text-[16px] leading-[2.2] mb-16"
            style={{ color: "var(--color-ink-text-soft)" }}
          >
            褒めるだけでも、慰めるだけでもない。
            <br />
            矛盾を指摘されるし、避けてきたものにも触れる。
            <br />
            少し疲れる 30 分かもしれません。
          </p>

          <Link
            href="/session"
            className="font-serif-jp inline-flex items-center text-[17px] tracking-[0.2em] gold-underline pb-[4px] tap-target"
            style={{ color: "var(--color-ink-text)" }}
          >
            はじめる
          </Link>
        </div>
      </section>

      <footer className="px-8 sm:px-16 pb-10 flex items-end justify-between gap-6 flex-wrap">
        <p
          className="text-[10px] leading-[2] max-w-[640px]"
          style={{ color: "var(--color-muted-2)" }}
        >
          ※
          踏み込んだ指摘を含むセッションです。心身が弱っている状態のときは利用を控えてください。
          <br />※ 会話の内容はサーバーに保存されません。
        </p>
        <Link
          href="/about"
          className="tap-target text-[10px] tracking-[0.3em]"
          style={{ color: "var(--color-muted-3)" }}
        >
          ABOUT
        </Link>
      </footer>
    </main>
  );
}
