"use client";

import { useEffect, useRef } from "react";

type Options = {
  /**
   * 下端追従モードを有効にする条件。最初は無効（オープニング画面で上端固定）
   * にしておきたいため、ユーザーが発言した瞬間に true へ切り替わる想定。
   */
  enabled: boolean;
  /**
   * 直近のメッセージ配列。新しいユーザーメッセージが追加されたタイミングを
   * 検知して、強制的に下端へスクロールするのに使う。
   */
  messages: { role: string }[];
};

/**
 * LINE 風スクロール制御。
 *
 * - ユーザーが「最下部付近」に居る限り、新着メッセージや段落フェードインで
 *   自動追従する。
 * - ユーザーが手動で上にスクロールしたら追従を止める。
 * - プログラム由来のスクロールは無視する（自動追従後の scroll イベントで
 *   誤って解除しないため）。
 * - 初期表示（オープニング宣言のみ）はユーザーが最初の発言をするまで上端固定。
 *   宣言文がスマホのファーストビューに収まらないと、最初の数行が画面外に流れて
 *   ユーザーが気付けないため。
 *
 * DOM の高さ変化を ResizeObserver/MutationObserver で監視し、
 * messages の更新タイミングに依存せず段落フェードインのたびに追従させる。
 */
export function useStickToBottom({ enabled, messages }: Options) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(false);
  const programmaticUntilRef = useRef(0);

  // enabled が true になった瞬間に下端追従モードへ切り替える。
  useEffect(() => {
    if (enabled) stickRef.current = true;
  }, [enabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const goToBottom = () => {
      programmaticUntilRef.current = Date.now() + 800;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    };

    const onScroll = () => {
      if (Date.now() < programmaticUntilRef.current) return;
      const distFromBottom =
        container.scrollHeight - container.clientHeight - container.scrollTop;
      stickRef.current = distFromBottom < 100;
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    const maybeFollow = () => {
      if (!stickRef.current) return;
      const distFromBottom =
        container.scrollHeight - container.clientHeight - container.scrollTop;
      if (distFromBottom > 0) goToBottom();
    };

    // 子要素のサイズ変化（段落の出現、フェードインで高さが伸びる等）
    const ro = new ResizeObserver(maybeFollow);
    Array.from(container.children).forEach((child) => ro.observe(child));
    // 子要素の追加・削除（新しいバブルが追加される）も監視
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) ro.observe(n);
        });
      }
      maybeFollow();
    });
    mo.observe(container, { childList: true });

    return () => {
      container.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  // ユーザーが新しいメッセージを送ったら強制的に下端へ。
  useEffect(() => {
    const last = messages[messages.length - 1];
    const container = containerRef.current;
    if (!last || !container) return;
    if (last.role === "user") {
      stickRef.current = true;
      programmaticUntilRef.current = Date.now() + 800;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  return containerRef;
}
