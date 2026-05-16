"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CardSection } from "@/components/result/CardSection";
import { ReportSection } from "@/components/result/ReportSection";
import { Toast } from "@/components/session/Toast";
import { useToast } from "@/lib/session/use-toast";
import { useCardImageExport } from "@/lib/result/use-card-image-export";
import { useReportPdfExport } from "@/lib/result/use-report-pdf-export";
import type { SessionResult } from "@/lib/types";

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<SessionResult | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toast = useToast(2400);

  const cardImage = useCardImageExport(cardRef, {
    onSuccess: toast.show,
    onError: toast.show,
  });

  const pdfExport = useReportPdfExport(result?.report ?? null, {
    onSuccess: toast.show,
    onError: toast.show,
  });

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

  // PDF / 画像保存に使う重いライブラリを表示直後にプリロードする。
  // 実際のボタン押下時にロードが始まると 3〜8 秒待たされるため、結果が
  // 見えた時点でバックグラウンド取得を開始しておく。動的 import なので
  // メインスレッドは詰まらず、保存しないまま閉じても害は無い（HTTP
  // キャッシュに乗るだけ）。
  useEffect(() => {
    if (!result) return;
    void import("@react-pdf/renderer");
    void import("@/components/ReportPdf");
    void import("html-to-image");
  }, [result]);

  if (!result) {
    return (
      <main className="calm-bg flex-1 flex items-center justify-center">
        <p className="text-[13px]" style={{ color: "var(--color-muted-3)" }}>
          読み込み中…
        </p>
      </main>
    );
  }

  return (
    <main className="calm-bg flex-1 w-full">
      <div className="w-full max-w-[820px] mx-auto px-4 sm:px-6 py-12">
        <header className="mb-12 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <a
            href="/"
            className="text-[13px] tracking-[0.2em] font-bold tap-target"
            style={{ color: "var(--color-ink-text)" }}
          >
            FASELU
          </a>
          <span
            className="text-[11px] tracking-[0.3em] font-medium"
            style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
              color: "var(--color-muted-3)",
            }}
          >
            face yourself
          </span>
        </div>
        <span
          className="text-[12px] tracking-[0.15em] font-medium"
          style={{ color: "var(--color-muted-2)" }}
        >
          {new Date().toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </header>

      <ReportSection
        report={result.report}
        onSavePdf={pdfExport.save}
        savingPdf={pdfExport.saving}
      />

      <div
        className="my-24 mx-auto max-w-[680px] border-t"
        style={{ borderColor: "var(--color-line-on-dark)" }}
      />

      <CardSection
        data={result.card}
        cardRef={cardRef}
        saving={cardImage.saving}
        onSave={cardImage.save}
      />

      <footer className="mt-20 mb-8 text-center">
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("faselu-result");
            router.replace("/");
          }}
          className="tap-target font-serif-jp text-[13px]"
          style={{ color: "var(--color-muted-3)" }}
        >
          セッションを閉じる
        </button>
      </footer>

      </div>
      {toast.message && <Toast message={toast.message} />}
    </main>
  );
}
