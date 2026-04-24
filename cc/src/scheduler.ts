import type { CalendarEvent, Env } from "./types";
import { sendTelegramMessage } from "./telegram";

export async function handleScheduled(cron: string, env: Env): Promise<void> {
  const kind = cron === "30 13 * * *" ? "calendar" : "todos";

  const message = kind === "calendar" ? await buildCalendarRundown(env) : await buildTodoReminder(env);
  await sendTelegramMessage(env, env.TELEGRAM_ALLOWED_CHAT_ID, message);
}

async function buildCalendarRundown(env: Env): Promise<string> {
  const events = await fetchCalendarEvents(env);
  if (events.length === 0) return "Calendar rundown: nothing scheduled today.";
  return `Calendar rundown:\n${events.map((event) => `- ${event.when}: ${event.summary}`).join("\n")}`;
}

async function buildTodoReminder(env: Env): Promise<string> {
  const todos = await fetchTodos(env);
  if (todos.length === 0) return "Todo reminder: no open tasks found.";
  return `Todo reminder:\n${todos.map((todo) => `- ${todo}`).join("\n")}`;
}

async function fetchCalendarEvents(env: Env): Promise<CalendarEvent[]> {
  const token = await googleAccessToken(env);
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
  });
  const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID ?? "primary");
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await response.text());

  const data = (await response.json()) as {
    items?: Array<{ summary?: string; start?: { dateTime?: string; date?: string } }>;
  };
  return (data.items ?? []).map((item) => ({
    summary: item.summary ?? "(untitled)",
    when: formatWhen(item.start?.dateTime ?? item.start?.date ?? "", env.TIMEZONE ?? "America/New_York"),
  }));
}

async function fetchTodos(env: Env): Promise<string[]> {
  const token = await googleAccessToken(env);
  const taskListId = encodeURIComponent(env.GOOGLE_TASK_LIST_ID ?? "@default");
  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?showCompleted=false`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await response.text());

  const data = (await response.json()) as { items?: Array<{ title?: string }> };
  return (data.items ?? []).map((item) => item.title).filter((title): title is string => Boolean(title));
}

async function googleAccessToken(env: Env): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(await response.text());

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google did not return an access token");
  return data.access_token;
}

function formatWhen(value: string, timezone: string): string {
  if (!value) return "Anytime";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(date);
}
