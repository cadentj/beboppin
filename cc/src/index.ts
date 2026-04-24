import { createOpenAI } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe } from "ai";

export type Env = {
  ASSETS: Fetcher;
  cc: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET_TOKEN?: string;
  TELEGRAM_ALLOWED_CHAT_ID: string;
  OPENAI_API_KEY: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
  WEB_AUTH_TOKEN?: string;
};

export const TAGS = ["learning", "tools", "ideas", "people", "opportunities"] as const;
export type Tag = (typeof TAGS)[number];

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
const TAG_PATTERN = new RegExp(`#(${TAGS.join("|")})\\b`, "i");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (env.WEB_AUTH_TOKEN) {
    const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("token") ?? "";
    if (bearer !== env.WEB_AUTH_TOKEN) return json({ error: "unauthorized" }, 401);
  }

  if (request.method === "GET" && url.pathname === "/api/links") {
    const [local, curius, thoughts] = await Promise.all([
      env.cc
        .prepare("SELECT id, url, tag, created_at FROM links ORDER BY created_at DESC LIMIT 500")
        .all()
        .then(({ results }) =>
          (results ?? []).map((r: any) => ({
            source: "local" as const,
            id: r.id as number,
            url: r.url as string,
            tag: (r.tag ?? null) as string | null,
            created_at: r.created_at as string,
          })),
        ),
      fetchCuriusLinks(),
      env.cc
        .prepare("SELECT id, content, created_at FROM thoughts ORDER BY created_at DESC LIMIT 500")
        .all()
        .then(({ results }) =>
          (results ?? []).map((r: any) => ({
            source: "thought" as const,
            id: r.id as number,
            content: r.content as string,
            created_at: r.created_at as string,
          })),
        ),
    ]);
    const links = [...local, ...curius, ...thoughts].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    );
    return json({ links, tags: TAGS });
  }

  if (request.method === "GET" && url.pathname === "/api/transcriptions") {
    const { results } = await env.cc
      .prepare("SELECT id, transcript, duration_seconds, created_at FROM transcriptions ORDER BY created_at DESC LIMIT 200")
      .all();
    return json({ transcriptions: results ?? [] });
  }

  const linkMatch = url.pathname.match(/^\/api\/links\/(\d+)$/);
  if (linkMatch && request.method === "PATCH") {
    return patchLink(request, env, Number(linkMatch[1]));
  }

  return json({ error: "not found" }, 404);
}

const CURIUS_USER_ID = "6562";

type CuriusLink = {
  source: "curius";
  id: number;
  url: string;
  title: string | null;
  snippet: string | null;
  created_at: string;
};

async function fetchCuriusLinks(): Promise<CuriusLink[]> {
  try {
    const res = await fetch(`https://curius.app/api/users/${CURIUS_USER_ID}/links?page=0`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      userSaved?: Array<{ id: number; link: string; title?: string | null; snippet?: string | null; createdDate: string }>;
    };
    return (data.userSaved ?? []).map((x) => ({
      source: "curius",
      id: x.id,
      url: x.link,
      title: x.title ?? null,
      snippet: x.snippet ?? null,
      created_at: x.createdDate,
    }));
  } catch (err) {
    console.error("curius fetch failed", err);
    return [];
  }
}

async function patchLink(request: Request, env: Env, id: number): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { tag?: string | null } | null;
  if (!body || body.tag === undefined) return json({ error: "bad request" }, 400);
  if (body.tag !== null && !isTag(body.tag)) return json({ error: "invalid tag" }, 400);

  const result = await env.cc
    .prepare("UPDATE links SET tag = ? WHERE id = ?")
    .bind(body.tag, id)
    .run();

  if (!result.success) return json({ error: "update failed" }, 500);
  return new Response(null, { status: 204 });
}

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
    const e = err as Error & { cause?: unknown; status?: number; responseBody?: string };
    console.error("processMessage failed", e, e.cause);
    const parts = [`error: ${e.message}`];
    if (e.status) parts.push(`status=${e.status}`);
    if (e.responseBody) parts.push(`body=${truncate(e.responseBody, 500)}`);
    if (e.cause) parts.push(`cause=${truncate(String((e.cause as Error)?.message ?? e.cause), 300)}`);
    await reply(env, chatId, parts.join("\n"));
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
  if (urls.length === 0) {
    await env.cc.prepare("INSERT INTO thoughts (content) VALUES (?)").bind(text).run();
    await reply(env, chatId, "saved thought.");
    return;
  }

  const tagMatch = text.match(TAG_PATTERN);
  const tag = tagMatch ? (tagMatch[1].toLowerCase() as Tag) : null;

  for (const url of urls) {
    await env.cc.prepare("INSERT INTO links (url, tag) VALUES (?, ?)").bind(url, tag).run();
  }
  const tagNote = tag ? ` as #${tag}` : "";
  await reply(env, chatId, `saved ${urls.length} link${urls.length === 1 ? "" : "s"}${tagNote}.`);
}

async function transcribeAudio(audio: ArrayBuffer, env: Env): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  const result = await transcribe({
    model: openai.transcription(env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"),
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

function isTag(value: unknown): value is Tag {
  return typeof value === "string" && (TAGS as readonly string[]).includes(value);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
