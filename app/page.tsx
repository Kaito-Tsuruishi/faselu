import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-8 sm:px-16 pt-10 flex flex-col gap-1">
        <span
          className="text-[15px] tracking-[0.4em] font-bold"
          style={{ color: "var(--color-ink-text)" }}
        >
          FASELU
        </span>
        <span
          className="text-[11px] tracking-[0.3em] font-medium"
          style={{
            fontFamily: "var(--font-noto-sans-jp), sans-serif",
            color: "var(--color-muted-3)",
          }}
        >
          自己分析サービス
        </span>
      </header>

      <section className="flex-1 flex items-center px-8 sm:px-16">
        <div className="max-w-[640px]">
          <span
            className="block text-[11px] tracking-[0.24em] font-bold uppercase mb-6"
            style={{ color: "var(--color-accent)" }}
          >
            Face yourself
          </span>
          <h1
            className="font-serif-jp text-[34px] sm:text-[44px] leading-[1.55] mb-12 font-semibold"
            style={{
              color: "var(--color-ink-text)",
              letterSpacing: "-0.01em",
            }}
          >
            分類されない、
            <br />
            あなた自身を、
            <br />
            探しに。
          </h1>

          <p
            className="font-serif-jp text-[15px] sm:text-[16px] leading-[2.1] mb-16"
            style={{ color: "var(--color-ink-text-soft)" }}
          >
            褒めるだけでも、慰めるだけでもない。
            <br />
            矛盾を指摘されるし、避けてきたものにも触れる。
            <br />
            ただ、あなたと向き合います。
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

      <footer className="px-8 sm:px-16 pb-10 flex flex-col gap-6">
        <p
          className="text-[12px] leading-[1.85]"
          style={{ color: "var(--color-muted-2)" }}
        >
          踏み込んだ問いを含みます。
          <br />
          会話の内容はサーバーに保存されません。
        </p>
        <Link
          href="/about"
          className="tap-target self-end text-[12px] tracking-[0.3em] font-semibold"
          style={{ color: "var(--color-muted-3)" }}
        >
          ABOUT
        </Link>
      </footer>
    </main>
  );
}
