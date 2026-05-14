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
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `faselu-report-${Date.now()}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onSuccess("PDF を書き出しました");
    } catch {
      onError("書き出しに失敗しました");
    } finally {
      setSaving(false);
    }
  }, [report, saving, onSuccess, onError]);

  return { saving, save };
}
