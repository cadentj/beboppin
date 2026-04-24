import type { Env, Tag } from "./types";

export async function saveLinks(
  env: Env,
  input: {
    urls: string[];
    tag: Tag;
    notes: string;
    sourceChatId: string;
    sourceMessageId: number;
    rawText: string;
  },
): Promise<void> {
  for (const url of input.urls) {
    await env.DB.prepare(
      "INSERT INTO links (url, tag, notes, source_chat_id, source_message_id, raw_text) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(url, input.tag, input.notes, input.sourceChatId, input.sourceMessageId, input.rawText)
      .run();
  }
}

export async function saveThought(
  env: Env,
  input: {
    body: string;
    sourceChatId: string;
    sourceMessageId: number;
  },
): Promise<void> {
  await env.DB.prepare("INSERT INTO thoughts (body, source_chat_id, source_message_id) VALUES (?, ?, ?)")
    .bind(input.body, input.sourceChatId, input.sourceMessageId)
    .run();
}

export async function saveTranscription(
  env: Env,
  input: {
    transcript: string;
    durationSeconds?: number;
    sourceChatId: string;
    sourceMessageId: number;
    telegramFileId: string;
  },
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO transcriptions (transcript, duration_seconds, source_chat_id, source_message_id, telegram_file_id) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(input.transcript, input.durationSeconds ?? null, input.sourceChatId, input.sourceMessageId, input.telegramFileId)
    .run();
}
