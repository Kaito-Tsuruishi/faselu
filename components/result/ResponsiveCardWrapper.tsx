"use client";

import { useLayoutEffect, useRef, useState } from "react";

const CARD_W = 420;
const CARD_BASE_H = 560;

/**
 * 画面幅が CARD_W (420px) 未満のときに、カードを縮小して表示するラッパー。
 *
 * カードは可変高さ (min-h-[560px] でコンテンツが長いと伸びる) なので、
 * 高さは内側 div の実高さを ResizeObserver で測って外側の領域に反映する。
 * 高さを CARD_BASE_H に固定すると、コンテンツが伸びたぶんが親領域から
 * はみ出し、html-to-image で画像保存したときに下部が欠ける問題が起きる。
 */
export function ResponsiveCardWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(CARD_BASE_H);

  useLayoutEffect(() => {
    const updateScale = () => {
      const w = outerRef.current?.clientWidth ?? CARD_W;
      const next = Math.min(1, w / CARD_W);
      setScale(next);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setInnerH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full flex justify-center">
      <div
        style={{
          width: CARD_W * scale,
          height: innerH * scale,
        }}
      >
        <div
          ref={innerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: CARD_W,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
