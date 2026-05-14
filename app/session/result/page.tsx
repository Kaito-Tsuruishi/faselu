"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { parseReport } from "@/lib/parse-report";
import type { SessionResult } from "@/lib/types";

const CARD_W = 420;
const CARD_H = 560;

function ResponsiveCardWrapper({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const update = () => {
      const w = outerRef.current?.clientWidth ?? CARD_W;
      const next = Math.min(1, w / CARD_W);
      setScale(next);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={outerRef} className="w-full flex justify-center">
      <div
        style={{
          width: CARD_W * scale,
          height: CARD_H * scale,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: CARD_W,
            height: CARD_H,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<SessionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("faselu-result");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw) as SessionResult);
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!result) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p
          className="text-[13px]"
          style={{ color: "var(--color-muted-3)" }}
        >
          読み込み中…
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-[820px] mx-auto px-4 sm:px-6 py-12">
      <header className="mb-12 flex items-center justify-between">
        <a
          href="/"
          className="text-[11px] tracking-[0.2em]"
          style={{ color: "var(--color-muted-3)" }}
        >
          FASELU
        </a>
        <span
          className="text-[11px] tracking-[0.15em]"
          style={{ color: "var(--color-muted-2)" }}
        >
          {new Date().toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </header>

      <article className="max-w-[680px] mx-auto">
        <div
          className="text-[10px] tracking-[0.3em] gold-text font-bold mb-3"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          DETAILED REPORT
        </div>
        <h2
          className="font-serif-jp text-[22px] leading-[1.7] mb-12"
          style={{ color: "var(--color-ink-text)" }}
        >
          あなたという人間の、詳細分析
        </h2>

        <div
          className="border-t mb-10"
          style={{ borderColor: "var(--color-line-on-dark)" }}
        />

        {parseReport(result.report).map((section, i) => (
          <section key={i} className="mb-12">
            <div
              className="text-[10px] tracking-[0.25em] gold-text font-bold mb-2"
              style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3
              className="font-serif-jp text-[18px] leading-[1.7] mb-5"
              style={{ color: "var(--color-ink-text)" }}
            >
              {section.heading}
            </h3>
            <p
              className="font-serif-jp text-[15px] leading-[2.1]"
              style={{
                color: "var(--color-ink-text-soft)",
                whiteSpace: "pre-wrap",
              }}
            >
              {section.body}
            </p>
          </section>
        ))}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={async () => {
              if (savingPdf || !result) return;
              setSavingPdf(true);
              try {
                const [{ pdf }, { ReportPdf }] = await Promise.all([
                  import("@react-pdf/renderer"),
                  import("@/components/ReportPdf"),
                ]);
                const blob = await pdf(
                  <ReportPdf report={result.report} />
                ).toBlob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.download = `faselu-report-${Date.now()}.pdf`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
              } finally {
                setSavingPdf(false);
              }
            }}
            disabled={savingPdf}
            className="font-serif-jp text-[13px] gold-underline pb-[2px] disabled:opacity-40"
            style={{ color: "var(--color-ink-text)" }}
          >
            {savingPdf ? "書き出し中…" : "詳細レポートを PDF で保存"}
          </button>
        </div>
      </article>

      <div
        className="my-24 mx-auto max-w-[680px] border-t"
        style={{ borderColor: "var(--color-line-on-dark)" }}
      />

      <section className="flex flex-col items-center mb-12">
        <div
          className="text-[10px] tracking-[0.3em] gold-text font-bold mb-3"
          style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif" }}
        >
          YOUR CARD
        </div>
        <h2
          className="font-serif-jp text-[22px] leading-[1.7] mb-12 text-center"
          style={{ color: "var(--color-ink-text)" }}
        >
          今日のあなた、を一枚に。
        </h2>

        <ResponsiveCardWrapper>
          <Card data={result.card} ref={cardRef} />
        </ResponsiveCardWrapper>

        <p
          className="mt-8 text-[11px] text-center"
          style={{ color: "var(--color-muted-3)" }}
        >
          信頼している人にだけ見せてください。
        </p>
        <button
          type="button"
          onClick={async () => {
            if (!cardRef.current || saving) return;
            setSaving(true);
            try {
              const { toPng } = await import("html-to-image");
              const node = cardRef.current;
              const dataUrl = await toPng(node, {
                pixelRatio: 3,
                cacheBust: true,
                canvasWidth: node.offsetWidth * 3,
                canvasHeight: node.offsetHeight * 3,
                style: {
                  transform: "scale(1)",
                  transformOrigin: "top left",
                },
              });
              const link = document.createElement("a");
              link.download = `faselu-${Date.now()}.png`;
              link.href = dataUrl;
              link.click();
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="mt-6 font-serif-jp text-[13px] gold-underline pb-[2px] disabled:opacity-40"
          style={{ color: "var(--color-ink-text)" }}
        >
          {saving ? "書き出し中…" : "画像で保存"}
        </button>
      </section>

      <footer className="mt-20 mb-8 text-center">
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("faselu-result");
            router.replace("/");
          }}
          className="font-serif-jp text-[13px]"
          style={{ color: "var(--color-muted-3)" }}
        >
          セッションを閉じる
        </button>
      </footer>
    </main>
  );
}
