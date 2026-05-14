import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const maxDuration = 60;

// LLM プロバイダの切替。FASELU_PROVIDER=groq で Groq を、それ以外なら Gemini を使う。
const PROVIDER = process.env.FASELU_PROVIDER ?? "gemini";

function getModel() {
  if (PROVIDER === "groq") {
    return groq("meta-llama/llama-4-scout-17b-16e-instruct");
  }
  return google("gemini-3.1-flash-lite-preview");
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
