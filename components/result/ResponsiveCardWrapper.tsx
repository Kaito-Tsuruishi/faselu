"use client";

import { useLayoutEffect, useRef, useState } from "react";

const CARD_W = 420;
const CARD_H = 560;

export function ResponsiveCardWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
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
