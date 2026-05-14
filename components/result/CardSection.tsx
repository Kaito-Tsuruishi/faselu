"use client";

import { Card } from "@/components/Card";
import { ResponsiveCardWrapper } from "./ResponsiveCardWrapper";
import type { CardData } from "@/lib/types";

type Props = {
  data: CardData;
  cardRef: React.RefObject<HTMLDivElement | null>;
  saving: boolean;
  onSave: () => void;
};

export function CardSection({ data, cardRef, saving, onSave }: Props) {
  return (
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
        本当のあなたを、一枚に。
      </h2>

      <ResponsiveCardWrapper>
        <Card data={data} ref={cardRef} />
      </ResponsiveCardWrapper>

      <p
        className="mt-8 text-[11px] text-center"
        style={{ color: "var(--color-muted-3)" }}
      >
        信頼している人にだけ見せてください。
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-6 tap-target font-serif-jp text-[14px] gold-underline pb-[2px] disabled:opacity-40"
        style={{ color: "var(--color-ink-text)" }}
      >
        {saving ? "書き出し中…" : "画像で保存"}
      </button>
    </section>
  );
}
