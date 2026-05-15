import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About / Faselu",
};

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "会話の取り扱い",
    body: `セッション中の会話は、サーバーには保存されません。
ブラウザを閉じた時点で消去されます。

ただし、対話の都度、入力された内容は
Google の Gemini API に送信されます。
Google 側のポリシーに従って、
入力内容が AI の学習に使われる可能性があります。`,
  },
  {
    heading: "入力に関するお願い",
    body: `氏名、住所、連絡先、所属など、
個人を特定できる情報の入力は避けてください。`,
  },
  {
    heading: "免責事項",
    body: `本サービスは医療・カウンセリング・診断行為ではありません。
心身の不調がある場合は、医療機関や専門家にご相談ください。

ご利用は利用者ご自身の判断にてお願いいたします。`,
  },
];

export default function AboutPage() {
  return (
    <main className="flex-1 w-full max-w-[680px] mx-auto px-6 sm:px-8 py-12">
      <header className="mb-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[14px] tracking-[0.3em] font-bold tap-target"
          style={{ color: "var(--color-ink-text)" }}
        >
          FASELU
        </Link>
        <span
          className="text-[12px] tracking-[0.3em] gold-text font-bold"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          ABOUT
        </span>
      </header>

      <article>
        {SECTIONS.map((section) => (
          <section key={section.heading} className="mb-12">
            <h2
              className="font-serif-jp text-[16px] leading-[1.7] mb-4"
              style={{ color: "var(--color-ink-text)" }}
            >
              {section.heading}
            </h2>
            <p
              className="font-serif-jp text-[14px] leading-[2]"
              style={{
                color: "var(--color-ink-text-soft)",
                whiteSpace: "pre-wrap",
              }}
            >
              {section.body}
            </p>
          </section>
        ))}
      </article>

      <footer className="mt-16 mb-8">
        <Link
          href="/"
          className="tap-target font-serif-jp text-[13px] gold-underline pb-[2px]"
          style={{ color: "var(--color-ink-text)" }}
        >
          トップに戻る
        </Link>
      </footer>
    </main>
  );
}
