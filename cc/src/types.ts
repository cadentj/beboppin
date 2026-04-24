export type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_WEBHOOK_SECRET_TOKEN?: string;
  TELEGRAM_ALLOWED_CHAT_ID: string;
  OPENAI_API_KEY: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_TRANSCRIPTION_MODEL?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_TASK_LIST_ID?: string;
  WEB_AUTH_TOKEN?: string;
  TIMEZONE?: string;
  LONG_TEXT_MIN_CHARS?: string;
};

export type Tag = (typeof TAGS)[number];

export const TAGS = ["learning", "tools", "ideas", "people", "opportunities"] as const;

export type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

export type TelegramMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  caption_entities?: TelegramEntity[];
  chat: { id: number | string; type: string };
  voice?: TelegramVoice;
  audio?: TelegramVoice;
  date: number;
};

export type TelegramEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
};

export type TelegramVoice = {
  file_id: string;
  file_unique_id?: string;
  duration?: number;
  mime_type?: string;
};

export type LinkRow = {
  id: number;
  url: string;
  tag: string;
  notes: string;
  raw_text: string;
  created_at: string;
};

export type TextRow = {
  id: number;
  body?: string;
  transcript?: string;
  created_at: string;
};

export type CalendarEvent = {
  when: string;
  summary: string;
};
