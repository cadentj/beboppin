import { handleTelegramWebhook } from "./bot";
import { handleScheduled } from "./scheduler";
import type { Env } from "./types";
import { renderViewer } from "./viewer";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleTelegramWebhook(request, env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method === "GET" && isViewerRoute(url.pathname)) {
      return renderViewer(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(controller.cron, env));
  },
};

function isViewerRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "/links" || pathname === "/thoughts" || pathname === "/transcriptions";
}

function json(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
