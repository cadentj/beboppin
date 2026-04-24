import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { experimental_transcribe as transcribe } from "ai";
import { renderViewer } from "./viewer";

export type Env = {
  cc: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET_TOKEN?: string;
  TELEGRAM_ALLOWED_CHAT_ID: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_MODEL_ID?: string;
  WEB_AUTH_TOKEN?: string;
};

type TelegramVoice = { file_id: string; duration?: number };
type TelegramMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  chat: { id: number | string };
  voice?: TelegramVoice;
  audio?: TelegramVoice;
};
type TelegramUpdate = { message?: TelegramMessage; edited_message?: TelegramMessage };

const URL_PATTERN = /https?:\/\/\S+/gi;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/links" || url.pathname === "/transcriptions")) {
      return renderViewer(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_WEBHOOK_SECRET_TOKEN) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== env.TELEGRAM_WEBHOOK_SECRET_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message ?? update.edited_message;
  if (!message) return new Response("ok");

  const chatId = String(message.chat.id);
  if (chatId !== env.TELEGRAM_ALLOWED_CHAT_ID) return new Response("ok");

  try {
    await processMessage(message, env);
  } catch (err) {
    await reply(env, chatId, `error: ${(err as Error).message}`);
  }
  return new Response("ok");
}

async function processMessage(message: TelegramMessage, env: Env): Promise<void> {
  const chatId = String(message.chat.id);
  const text = (message.text ?? message.caption ?? "").trim();

  const voice = message.voice ?? message.audio;
  if (voice) {
    const audio = await downloadTelegramFile(env, voice.file_id);
    const transcript = await transcribeAudio(audio, env);
    await env.cc
      .prepare("INSERT INTO transcriptions (transcript, duration_seconds) VALUES (?, ?)")
      .bind(transcript, voice.duration ?? null)
      .run();
    await reply(env, chatId, `transcribed:\n\n${truncate(transcript, 1200)}`);
    return;
  }

  if (!text) return;

  const urls = [...new Set([...text.matchAll(URL_PATTERN)].map((m) => m[0].replace(/[.,;:!?)]+$/g, "")))];
  if (urls.length === 0) return;

  const notes = text.replace(URL_PATTERN, "").trim();
  for (const url of urls) {
    await env.cc.prepare("INSERT INTO links (url, notes) VALUES (?, ?)").bind(url, notes).run();
  }
  await reply(env, chatId, `saved ${urls.length} link${urls.length === 1 ? "" : "s"}.`);
}

async function transcribeAudio(audio: ArrayBuffer, env: Env): Promise<string> {
  const elevenlabs = createElevenLabs({ apiKey: env.ELEVENLABS_API_KEY });
  const result = await transcribe({
    model: elevenlabs.transcription(env.ELEVENLABS_MODEL_ID ?? "scribe_v1"),
    audio: new Uint8Array(audio),
  });
  const text = result.text.trim();
  if (!text) throw new Error("empty transcript");
  return text;
}

async function downloadTelegramFile(env: Env, fileId: string): Promise<ArrayBuffer> {
  const meta = await telegramApi<{ file_path?: string }>(env, "getFile", { file_id: fileId });
  if (!meta.file_path) throw new Error("no file_path from telegram");
  const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${meta.file_path}`);
  if (!res.ok) throw new Error(`file download failed: ${res.status}`);
  return res.arrayBuffer();
}

async function reply(env: Env, chatId: string, text: string): Promise<void> {
  await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text: truncate(text, 3900),
    disable_web_page_preview: true,
  });
}

async function telegramApi<T = unknown>(env: Env, method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(data.description ?? `telegram ${method} failed`);
  return data.result as T;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
