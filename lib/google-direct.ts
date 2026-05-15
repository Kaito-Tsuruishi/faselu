import type { ModelMessage } from "ai";

const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = { text?: string; thought?: boolean };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiStreamChunk = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
};

type StreamGoogleArgs = {
  model: string;
  apiKey: string;
  system: string;
  messages: ModelMessage[];
  temperature?: number;
  signal?: AbortSignal;
  /**
   * "dialogue" のときは `<<READY_FOR_FINAL>>` を検知してそれ以降を破棄する。
   * "final" のときは通常出力を素通しする。
   */
  mode?: "dialogue" | "final";
};

function toGeminiContents(messages: ModelMessage[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const content = m.content;
    const parts: GeminiPart[] = [];
    if (typeof content === "string") {
      parts.push({ text: content });
    } else if (Array.isArray(content)) {
      for (const c of content) {
        if (c && typeof c === "object" && "type" in c && c.type === "text" && typeof (c as { text?: unknown }).text === "string") {
          parts.push({ text: (c as { text: string }).text });
        }
      }
    }
    if (parts.length > 0) out.push({ role, parts });
  }
  return out;
}

function takeEvent(buf: string): [string | null, string] {
  const i1 = buf.indexOf("\r\n\r\n");
  const i2 = buf.indexOf("\n\n");
  let sep = -1;
  let sepLen = 0;
  if (i1 >= 0 && (i2 < 0 || i1 <= i2)) {
    sep = i1;
    sepLen = 4;
  } else if (i2 >= 0) {
    sep = i2;
    sepLen = 2;
  }
  if (sep < 0) return [null, buf];
  return [buf.slice(0, sep), buf.slice(sep + sepLen)];
}

function parseDataLine(eventBlock: string): string | null {
  const lines = eventBlock.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data: ")) dataLines.push(line.slice(6));
    else if (line.startsWith("data:")) dataLines.push(line.slice(5));
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

export async function streamGoogleResponse({
  model,
  apiKey,
  system,
  messages,
  temperature,
  signal,
  mode = "dialogue",
}: StreamGoogleArgs): Promise<Response> {
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: toGeminiContents(messages),
    ...(typeof temperature === "number"
      ? { generationConfig: { temperature } }
      : {}),
  };

  // Google AI Studio API は無料 tier では 500 INTERNAL や 503 UNAVAILABLE を
  // 頻繁に返してくる (公式 troubleshooting でも「リトライしろ」が公式回答)。
  // ユーザー側に「通信エラー」を見せずに自動で retry する。
  // signal が abort されたら即諦める (ユーザー意図的中断)。
  // Vercel Hobby のハードタイムアウトが 60 秒。Flash Lite の通常応答は 10〜30 秒
  // なので、合計 7 秒程度のリトライ予算なら最悪 37 秒で完了し本番でも安全圏。
  const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
  const RETRY_DELAYS_MS = [500, 1500, 3000, 5000];

  let upstream: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal?.aborted) break;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (res.ok && res.body) {
        upstream = res;
        break;
      }
      // body をここで一度読まないと、次の試行で接続再利用が失敗する可能性がある
      const errText = await res.text().catch(() => "");
      lastErr = `HTTP ${res.status}: ${errText}`;
      if (!RETRYABLE_STATUSES.has(res.status)) {
        // retry しても改善しないステータス (400, 401 等) はそのまま返す
        return new Response(`Gemma upstream error ${res.status}: ${errText}`, {
          status: 502,
        });
      }
    } catch (err) {
      // abort なら即終了。それ以外のネットワーク系エラーは retry 対象
      if (signal?.aborted) throw err;
      const isAbortError =
        err instanceof Error &&
        (err.name === "AbortError" || /aborted/i.test(err.message));
      if (isAbortError) throw err;
      lastErr = err;
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (!upstream || !upstream.body) {
    return new Response(`Gemma upstream error after retries: ${String(lastErr)}`, {
      status: 502,
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  const textId = `gemma-text-${Date.now()}`;

  // 対話モードでは `<<READY_FOR_FINAL>>` を検知する。
  // 最終分析モードでは通常出力を素通しする（モデルがプロンプト指示通り
  // `## あなたという人間の構造` から書き始める想定）。
  const SENTINEL =
    mode === "dialogue" ? "<<READY_FOR_FINAL>>" : null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeEvent = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      let textStarted = false;
      let buf = "";

      // SENTINEL 制御（対話モードのみ）。
      // - sentinelSeen=false の間、出力末尾が SENTINEL のプレフィックスに
      //   一致しうる範囲だけを `pending` に保留してから残りを流す。
      //   トークン直前の前置き文がチラ見えしないようにする一方、通常チャットでは
      //   保留が数文字以内で済むためストリーミング体感は維持される。
      // - 一度 SENTINEL が見つかったら、それ以前に出力されたテキストは全部破棄して
      //   クライアントには SENTINEL 文字列だけを流す。それ以降のテキストも破棄。
      //   こうしてフロントは「対話バブルが真っ白 → 最後にトークンだけ届く」
      //   という挙動になり、READY_FOR_FINAL の検知後すぐ次のターン（レポート）へ
      //   遷移できる。
      let sentinelSeen = false;
      let pending = "";

      const longestPrefixMatchLen = (s: string, token: string): number => {
        const maxLen = Math.min(s.length, token.length - 1);
        for (let n = maxLen; n > 0; n--) {
          if (token.startsWith(s.slice(s.length - n))) {
            return n;
          }
        }
        return 0;
      };

      const emitText = (raw: string) => {
        if (!raw) return;

        // sentinel 監視が無いモード（final）は素通し。
        if (!SENTINEL) {
          if (!textStarted) {
            writeEvent({ type: "text-start", id: textId });
            textStarted = true;
          }
          writeEvent({ type: "text-delta", id: textId, delta: raw });
          return;
        }

        // 既に SENTINEL を検知済み → 以降はすべて破棄。
        if (sentinelSeen) return;

        pending += raw;

        const tokenIdx = pending.indexOf(SENTINEL);
        if (tokenIdx >= 0) {
          sentinelSeen = true;
          // SENTINEL 直前までの本文は破棄。クライアントには SENTINEL 文字列だけ流す。
          if (!textStarted) {
            writeEvent({ type: "text-start", id: textId });
            textStarted = true;
          }
          writeEvent({ type: "text-delta", id: textId, delta: SENTINEL });
          pending = "";
          return;
        }

        // トークン全体は見つからない。末尾が部分一致しうる分だけ保留し、
        // それより前は通常応答として確定 → 流す。
        const keep = longestPrefixMatchLen(pending, SENTINEL);
        const flushable = pending.slice(0, pending.length - keep);
        pending = pending.slice(pending.length - keep);
        if (flushable) {
          if (!textStarted) {
            writeEvent({ type: "text-start", id: textId });
            textStarted = true;
          }
          writeEvent({ type: "text-delta", id: textId, delta: flushable });
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          while (true) {
            const [event, rest] = takeEvent(buf);
            if (event === null) break;
            buf = rest;
            const dataStr = parseDataLine(event);
            if (!dataStr) continue;
            if (dataStr === "[DONE]") continue;

            let payload: GeminiStreamChunk;
            try {
              payload = JSON.parse(dataStr) as GeminiStreamChunk;
            } catch {
              continue;
            }

            const parts = payload.candidates?.[0]?.content?.parts ?? [];
            for (const p of parts) {
              if (!p || typeof p !== "object") continue;
              if (p.thought) continue;
              const text = p.text;
              if (typeof text !== "string" || text.length === 0) continue;
              emitText(text);
            }
          }
        }

        // ストリーム終了。SENTINEL を見ずに pending が残っている場合は
        // 通常応答の末尾なのでそのまま流す（対話モードのみで発生）。
        if (SENTINEL && !sentinelSeen && pending) {
          if (!textStarted) {
            writeEvent({ type: "text-start", id: textId });
            textStarted = true;
          }
          writeEvent({ type: "text-delta", id: textId, delta: pending });
          pending = "";
        }

        if (textStarted) {
          writeEvent({ type: "text-end", id: textId });
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
