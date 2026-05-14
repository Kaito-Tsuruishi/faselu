import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { streamGemmaResponse } from "@/lib/gemma-direct";

export const maxDuration = 60;

const PROVIDER = process.env.FASELU_PROVIDER ?? "gemini";
const GEMINI_MODEL =
  process.env.FASELU_GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  if (PROVIDER === "gemini" && GEMINI_MODEL.startsWith("gemma-")) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response("GOOGLE_GENERATIVE_AI_API_KEY is not set", {
        status: 500,
      });
    }
    return streamGemmaResponse({
      model: GEMINI_MODEL,
      apiKey,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      temperature: 0.7,
      signal: req.signal,
    });
  }

  const model =
    PROVIDER === "groq"
      ? groq("meta-llama/llama-4-scout-17b-16e-instruct")
      : google(GEMINI_MODEL);

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
