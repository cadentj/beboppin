import { createTelegramAdapter } from "@chat-adapter/telegram";
import { Chat, type Message, type Thread } from "chat";
import { classifyTag, transcribeAudio } from "./ai";
import { createMemoryState } from "./state";
import { saveLinks, saveThought, saveTranscription } from "./storage";
import { downloadTelegramFile } from "./telegram";
import type { Env, TelegramEntity, TelegramMessage } from "./types";
import { TAGS } from "./types";

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const bot = createBot(env);
  return bot.webhooks.telegram(request);
}

function createBot(env: Env): Chat {
  const bot = new Chat({
    userName: env.TELEGRAM_BOT_USERNAME ?? "cc",
    concurrency: "queue",
    state: createMemoryState(),
    adapters: {
      telegram: createTelegramAdapter({
        mode: "webhook",
        botToken: env.TELEGRAM_BOT_TOKEN,
        secretToken: env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
      }),
    },
  });

  bot.onDirectMessage(async (thread, message) => {
    await processChatMessage(thread, message, env);
  });

  bot.onNewMessage(/[\s\S]*/, async (thread, message) => {
    await processChatMessage(thread, message, env);
  });

  return bot;
}

async function processChatMessage(thread: Thread, message: Message, env: Env): Promise<void> {
  const raw = message.raw as TelegramMessage | undefined;
  if (!raw) return;

  const chatId = String(raw.chat.id);
  if (chatId !== env.TELEGRAM_ALLOWED_CHAT_ID) return;

  const text = (message.text ?? raw.text ?? raw.caption ?? "").trim();

  if (text === "/start") {
    await thread.post("Send a link, a long thought, or a voice memo. I will file it.");
    return;
  }

  if (text === "/help") {
    await thread.post(`Tags: ${TAGS.map((tag) => `#${tag}`).join(", ")}`);
    return;
  }

  if (raw.voice || raw.audio) {
    const file = raw.voice ?? raw.audio;
    if (!file) return;

    const audio = await downloadTelegramFile(env, file.file_id);
    const transcript = await transcribeAudio(audio, env);
    await saveTranscription(env, {
      transcript,
      durationSeconds: file.duration,
      sourceChatId: chatId,
      sourceMessageId: raw.message_id,
      telegramFileId: file.file_id,
    });
    await thread.post(`Transcribed and saved:\n\n${truncate(transcript, 1200)}`);
    return;
  }

  if (!text) return;

  const urls = extractUrls(text, raw.entities ?? raw.caption_entities ?? []);
  if (urls.length > 0) {
    const tag = await classifyTag(text, urls, env);
    await saveLinks(env, {
      urls,
      tag,
      notes: "",
      sourceChatId: chatId,
      sourceMessageId: raw.message_id,
      rawText: text,
    });
    await thread.post(`Saved ${urls.length === 1 ? "link" : `${urls.length} links`} as #${tag}.`);
    return;
  }

  const minChars = Number.parseInt(env.LONG_TEXT_MIN_CHARS ?? "240", 10);
  if (text.length >= minChars) {
    await saveThought(env, {
      body: text,
      sourceChatId: chatId,
      sourceMessageId: raw.message_id,
    });
    await thread.post("Saved that thought.");
  }
}

function extractUrls(text: string, entities: TelegramEntity[]): string[] {
  const urls = new Set<string>();
  for (const entity of entities) {
    if (entity.type === "text_link" && entity.url) {
      urls.add(cleanUrl(entity.url));
    }
    if (entity.type === "url") {
      urls.add(cleanUrl(text.slice(entity.offset, entity.offset + entity.length)));
    }
  }
  for (const match of text.matchAll(URL_PATTERN)) {
    urls.add(cleanUrl(match[0]));
  }
  return [...urls].filter(Boolean);
}

function cleanUrl(url: string): string {
  return url.replace(/[.,;:!?]+$/g, "");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
