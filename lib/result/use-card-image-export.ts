"use client";

import { useCallback, useState } from "react";

type Options = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function useCardImageExport(
  cardRef: React.RefObject<HTMLDivElement | null>,
  { onSuccess, onError }: Options,
) {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      const { toBlob } = await import("html-to-image");
      const node = cardRef.current;
      // 初回はキャッシュが効かないことがあるので 2 回試行する
      await toBlob(node, { pixelRatio: 1, cacheBust: true }).catch(() => null);
      const blob = await toBlob(node, {
        pixelRatio: 3,
        cacheBust: true,
        canvasWidth: node.offsetWidth * 3,
        canvasHeight: node.offsetHeight * 3,
        backgroundColor: "#0e0e10",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });
      if (!blob) {
        onError("保存に失敗しました");
        return;
      }
      const fileName = `faselu-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file] });
          onSuccess("共有しました");
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = fileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onSuccess("画像を保存しました");
    } catch {
      onError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [cardRef, saving, onSuccess, onError]);

  return { saving, save };
}
