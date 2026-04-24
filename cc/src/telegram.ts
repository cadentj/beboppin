import type { Env } from "./types";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export async function downloadTelegramFile(env: Env, fileId: string): Promise<ArrayBuffer> {
  const file = await telegramApi<{ file_path?: string }>(env, "getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram did not return a file path");

  const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) throw new Error(`Telegram file download failed: ${response.status}`);
  return response.arrayBuffer();
}

export async function sendTelegramMessage(env: Env, chatId: string, text: string): Promise<void> {
  await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text: truncate(text, 3900),
    disable_web_page_preview: true,
  });
}

async function telegramApi<T = unknown>(env: Env, method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram ${method} failed`);
  return data.result as T;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
