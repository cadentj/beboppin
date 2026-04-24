import { createOpenAI } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe, generateText, Output } from "ai";
import { z } from "zod";
import type { Env, Tag } from "./types";
import { TAGS } from "./types";

const tagSchema = z.object({
  tag: z.enum(TAGS),
});

export async function classifyTag(text: string, urls: string[], env: Env): Promise<Tag> {
  const explicit = text.match(/#(learning|tools|ideas|people|opportunities)\b/i)?.[1]?.toLowerCase();
  if (explicit && isTag(explicit)) return explicit;

  return classifyTagWithAiSdk(text, urls, env);
}

export async function transcribeAudio(audio: ArrayBuffer, env: Env): Promise<string> {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  const result = await transcribe({
    model: openai.transcription(env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe"),
    audio: new Uint8Array(audio),
  });

  if (!result.text.trim()) throw new Error("No transcript returned");
  return result.text.trim();
}

async function classifyTagWithAiSdk(text: string, urls: string[], env: Env): Promise<Tag> {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  const { output } = await generateText({
    model: openai(env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini"),
    output: Output.object({
      schema: tagSchema,
      name: "LinkTag",
      description: "A single tag for a saved link.",
    }),
    prompt: [
      `Classify this saved link into exactly one tag: ${TAGS.join(", ")}.`,
      "Use learning for courses, papers, tutorials, and references.",
      "Use tools for libraries, frameworks, products, and utilities.",
      "Use ideas for concepts, inspiration, opinions, and design references.",
      "Use people for personal pages, researchers, artists, and profiles.",
      "Use opportunities for jobs, roles, fellowships, and applications.",
      "",
      JSON.stringify({ text, urls }),
    ].join("\n"),
  });

  return output.tag;
}

function isTag(value: string): value is Tag {
  return TAGS.includes(value as Tag);
}
