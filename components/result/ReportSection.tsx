import { parseReport } from "@/lib/parse-report";

type Props = {
  report: string;
  onSavePdf: () => void;
  savingPdf: boolean;
};

export function ReportSection({ report, onSavePdf, savingPdf }: Props) {
  const sections = parseReport(report);

  return (
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

      {sections.map((section, i) => (
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
          onClick={onSavePdf}
          disabled={savingPdf}
          className="tap-target font-serif-jp text-[14px] gold-underline pb-[2px] disabled:opacity-40"
          style={{ color: "var(--color-ink-text)" }}
        >
          {savingPdf ? "書き出し中…" : "詳細レポートを PDF で保存"}
        </button>
      </div>
    </article>
  );
}
