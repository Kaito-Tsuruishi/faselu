"use client";

import { useCallback, useState } from "react";

type Options = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function useReportPdfExport(
  report: string | null,
  { onSuccess, onError }: Options,
) {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!report || saving) return;
    setSaving(true);
    try {
      const [{ pdf }, { ReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/ReportPdf"),
      ]);
      const blob = await pdf(<ReportPdf report={report} />).toBlob();
      const fileName = `faselu-report-${Date.now()}.pdf`;

      // iOS Safari は <a download> を無視して blob URL に直接ナビゲートしてしまう。
      // また URL.revokeObjectURL を即時実行するとロード前に破棄されて壊れる。
      // 段階的に最良の方法を試す:
      // 1) Web Share API (iOS で「ファイルに保存」「メール」「メッセージ」等が選べる)
      // 2) 新規タブで開く (PDF プレビューが表示され、ユーザーが手動で保存できる)
      // 3) <a download> でダウンロード (PC ブラウザ向け)

      const file = new File([blob], fileName, { type: "application/pdf" });
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file] });
          onSuccess("PDF を共有しました");
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          // Web Share API が失敗したら後続のフォールバックへ
        }
      }

      const url = URL.createObjectURL(blob);

      // 新規タブで開く。iOS では PDF プレビューが表示され、共有メニューから保存できる。
      const newWin = window.open(url, "_blank");
      if (newWin) {
        onSuccess("PDF を開きました");
      } else {
        // ポップアップブロックされた場合のフォールバック。PC ブラウザではこちらが効く。
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.target = "_blank";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onSuccess("PDF を書き出しました");
      }

      // ブラウザがロードする時間を確保するため、revoke は十分遅延させる。
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      onError("書き出しに失敗しました");
    } finally {
      setSaving(false);
    }
  }, [report, saving, onSuccess, onError]);

  return { saving, save };
}
