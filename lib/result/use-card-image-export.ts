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
      // requestAnimationFrame でレイアウト確定を保証してから撮る。
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      // ResponsiveCardWrapper が画面幅に応じて scale をかけている場合、
      // html-to-image のキャプチャ範囲が変形済みサイズになって
      // カード下部・側面が欠ける問題があるため、本来の (420 x 実高さ) を
      // 明示する。style.transform で scale をリセットして本来サイズで撮る。
      const cardWidth = node.offsetWidth;
      const cardHeight = node.offsetHeight;
      const blob = await toBlob(node, {
        pixelRatio: 3,
        cacheBust: true,
        width: cardWidth,
        height: cardHeight,
        // 背景色を指定しないことで、カードの角丸の外側を透明にする。
        // 透過 PNG として書き出されるので、Instagram ストーリーや LP に
        // 載せたときにカードの形状だけが浮かぶ。
        style: {
          transform: "none",
          transformOrigin: "top left",
          // box-shadow は下方向 16px に伸びていて、html-to-image がそれを
          // キャプチャ範囲に含めてしまうと下端 4 隅にうっすら影が残って
          // 「四角い薄ベージュ」に見える。保存時だけシャドウを外す。
          boxShadow: "none",
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
