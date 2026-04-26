#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import localtunnel from "localtunnel";
import { join } from "path";
import { ulid } from "ulid";

// ─── Config ──────────────────────────────────────────────────────────────────

const HOME = process.env.HOME ?? "~";
const PORT = 3000;
const API_URL = "https://chatgpt.com/backend-api/codex/responses";
const AUTH_PATH = join(HOME, ".codex", "auth.json");
const CONFIG_DIR = join(HOME, ".codex", "cursor-proxy");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const RECENT_EVENT_LIMIT = 6;

// Parameters the Codex Responses API accepts
const ALLOWED_PARAMS = new Set([
  "model",
  "input",
  "instructions",
  "tools",
  "tool_choice",
  "store",
  "include",
  "stream",
  "reasoning",
  "temperature",
  "top_p",
  "max_output_tokens",
  "truncation",
  "text",
  "parallel_tool_calls",
  "previous_response_id",
]);

// ─── Auth ────────────────────────────────────────────────────────────────────

function getAccessToken(): string {
  try {
    const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8"));
    return auth?.tokens?.access_token ?? "";
  } catch {
    dashboardEvent(`Could not read ${AUTH_PATH}`);
    return "";
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

type UsageStats = {
  input: number;
  cachedInput: number;
  output: number;
  reasoningOutput: number;
  total: number;
};

type RequestInfo = {
  id: number;
  model: string;
  inputCount: number;
  toolCount: number;
  startedAt: number;
};

type LastStatus = {
  status: number | null;
  phase: "starting" | "streaming" | "completed" | "error" | "idle";
  at: number;
  detail?: string;
};

type ResponsesUsage = {
  input_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens?: number;
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
  total_tokens?: number;
};

type DashboardStats = {
  startedAt: number;
  resetAt: number;
  tunnelUrl: string;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  activeRequests: Map<number, RequestInfo>;
  lastRequestId: number;
  latestActiveRequestId: number;
  usage: UsageStats;
  lastStatus: LastStatus;
  events: string[];
};

const stats: DashboardStats = {
  startedAt: Date.now(),
  resetAt: Date.now(),
  tunnelUrl: "",
  totalRequests: 0,
  completedRequests: 0,
  failedRequests: 0,
  activeRequests: new Map<number, RequestInfo>(),
  lastRequestId: 0,
  latestActiveRequestId: 0,
  usage: {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoningOutput: 0,
    total: 0,
  },
  lastStatus: {
    status: null,
    phase: "idle",
    at: Date.now(),
  },
  events: [],
};

let dashboardInitialized = false;
let shuttingDown = false;
let server: ReturnType<typeof Bun.serve> | undefined;
let tunnel: Awaited<ReturnType<typeof localtunnel>> | undefined;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function timestamp(at = Date.now()): string {
  return new Date(at).toLocaleTimeString();
}

function dashboardEvent(message: string): void {
  stats.events.unshift(`${timestamp()}  ${message}`);
  stats.events = stats.events.slice(0, RECENT_EVENT_LIMIT);
  renderDashboard();
}

function renderDashboard(): void {
  if (!process.stdout.isTTY) return;

  const now = Date.now();
  const current = stats.activeRequests.get(stats.latestActiveRequestId);
  const activeLine = current
    ? `#${current.id} ${current.model} | ${current.inputCount} messages | ${current.toolCount} tools | ${formatDuration(now - current.startedAt)}`
    : "none";
  const status = stats.lastStatus.status === null
    ? stats.lastStatus.phase
    : `${stats.lastStatus.status} ${stats.lastStatus.phase}`;
  const statusDetail = stats.lastStatus.detail ? ` | ${stats.lastStatus.detail}` : "";
  const tunnelUrl = stats.tunnelUrl || "starting localtunnel...";
  const events = stats.events.length > 0 ? stats.events : ["No requests yet."];

  const lines = [
    "codex-cursor-proxy",
    "",
    `OpenAI Base URL for Cursor: ${tunnelUrl}`,
    "API Key: Anything you like!",
    "",
    `Running: ${formatDuration(now - stats.startedAt)} | Since reset: ${formatDuration(now - stats.resetAt)} | Keys: r reset, q quit, Ctrl+C quit`,
    "",
    `Requests: ${formatNumber(stats.totalRequests)} total | ${formatNumber(stats.completedRequests)} completed | ${formatNumber(stats.failedRequests)} failed | ${formatNumber(stats.activeRequests.size)} active`,
    `Pending: ${activeLine}`,
    `Last status: ${status} @ ${timestamp(stats.lastStatus.at)}${statusDetail}`,
    "",
    `Tokens: ${formatNumber(stats.usage.total)} total | ${formatNumber(stats.usage.input)} input | ${formatNumber(stats.usage.cachedInput)} cached | ${formatNumber(stats.usage.output)} output | ${formatNumber(stats.usage.reasoningOutput)} reasoning`,
    "",
    "Recent:",
    ...events.map((event) => `  ${event}`),
    "",
  ];

  if (!dashboardInitialized) {
    process.stdout.write("\x1b[?25l");
    dashboardInitialized = true;
  }

  process.stdout.write(`\x1b[H\x1b[2J${lines.join("\n")}`);
}

function resetDisplayedStats(): void {
  stats.resetAt = Date.now();
  stats.totalRequests = 0;
  stats.completedRequests = 0;
  stats.failedRequests = 0;
  stats.usage = {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoningOutput: 0,
    total: 0,
  };
  stats.events = [];
  dashboardEvent("Reset displayed totals");
}

function startRequest(model: string, inputCount: number, toolCount: number): number {
  const id = ++stats.lastRequestId;
  stats.totalRequests += 1;
  stats.latestActiveRequestId = id;
  stats.activeRequests.set(id, {
    id,
    model,
    inputCount,
    toolCount,
    startedAt: Date.now(),
  });
  stats.lastStatus = { status: null, phase: "starting", at: Date.now() };
  dashboardEvent(`-> #${id} ${model} | ${inputCount} messages | ${toolCount} tools`);
  return id;
}

function markStreaming(requestId: number, status: number): void {
  stats.lastStatus = { status, phase: "streaming", at: Date.now() };
  dashboardEvent(`<- #${requestId} ${status} streaming`);
}

function markUsage(requestId: number, usage: ResponsesUsage): void {
  const input = usage.input_tokens ?? 0;
  const cachedInput = usage.input_tokens_details?.cached_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const reasoningOutput = usage.output_tokens_details?.reasoning_tokens ?? 0;
  const total = usage.total_tokens ?? input + output;

  stats.usage.input += input;
  stats.usage.cachedInput += cachedInput;
  stats.usage.output += output;
  stats.usage.reasoningOutput += reasoningOutput;
  stats.usage.total += total;

  dashboardEvent(
    `<- #${requestId} usage ${formatNumber(total)} total (${formatNumber(input)} in, ${formatNumber(output)} out)`,
  );
}

function markComplete(requestId: number): void {
  stats.completedRequests += 1;
  stats.lastStatus = { status: 200, phase: "completed", at: Date.now() };
  dashboardEvent(`<- #${requestId} completed`);
}

function markFailed(requestId: number, status: number, detail?: string): void {
  stats.failedRequests += 1;
  stats.activeRequests.delete(requestId);
  stats.lastStatus = { status, phase: "error", at: Date.now(), detail };
  dashboardEvent(`<- #${requestId} ${status} ERROR${detail ? ` ${detail}` : ""}`);
}

function closeRequest(requestId: number): void {
  stats.activeRequests.delete(requestId);
  if (stats.latestActiveRequestId === requestId) {
    stats.latestActiveRequestId = Array.from(stats.activeRequests.keys()).at(-1) ?? 0;
  }
  renderDashboard();
}

function setupKeyboard(): void {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (key) => {
    if (key === "r") {
      resetDisplayedStats();
    } else if (key === "q" || key === "\u0003") {
      void shutdown();
    }
  });
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  if (dashboardInitialized && process.stdout.isTTY) {
    process.stdout.write("\x1b[?25h\n");
  }

  tunnel?.close();
  server?.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.on("exit", () => {
  if (dashboardInitialized && process.stdout.isTTY) {
    process.stdout.write("\x1b[?25h");
  }
});

// ─── Tunnel ──────────────────────────────────────────────────────────────────

function getSubdomain(): string {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    if (config.subdomain) return config.subdomain;
  } catch {}

  const subdomain = ulid().toLowerCase();
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ subdomain }, null, 2) + "\n");
  return subdomain;
}

// ─── Request transformation ──────────────────────────────────────────────────

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  // Promote the first system message to the top-level `instructions` field
  if (!body.instructions && Array.isArray(body.input)) {
    const idx = body.input.findIndex((m: { role?: string }) => m.role === "system");
    if (idx !== -1) {
      body.instructions = body.input[idx].content;
      body.input.splice(idx, 1);
    }
  }

  body.store = false;
  body.stream = true;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_PARAMS.has(key)) delete body[key];
  }

  return body;
}

// ─── Response stream translation ─────────────────────────────────────────────
// Converts Responses API SSE events into Chat Completions SSE chunks so that
// clients like Cursor (which speak the completions protocol) can consume them.

function responsesToCompletionsStream(
  upstream: ReadableStream<Uint8Array>,
  model: string,
  lifecycle: {
    onUsage?: (usage: ResponsesUsage) => void;
    onComplete?: () => void;
    onStreamClosed?: () => void;
  } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let buffer = "";
  let id = "chatcmpl-" + crypto.randomUUID();
  const created = Math.floor(Date.now() / 1000);
  const toolIndices = new Map<string, number>();
  let nextToolIdx = 0;

  function chunk(delta: Record<string, unknown>, finish: string | null = null) {
    return `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`;
  }

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      controller.enqueue(encoder.encode(chunk({ role: "assistant" })));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
              continue;
            }
            if (!line.startsWith("data: ")) continue;

            let evt: Record<string, unknown>;
            try {
              evt = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            const type = (evt.type as string) ?? eventType;

            if (type === "response.output_text.delta") {
              const d = evt.delta as string;
              if (d) controller.enqueue(encoder.encode(chunk({ content: d })));
            } else if (type === "response.reasoning.delta") {
              const d = evt.delta as string;
              if (d) controller.enqueue(encoder.encode(chunk({ reasoning_content: d })));
            } else if (type === "response.output_item.added") {
              const item = evt.item as Record<string, unknown> | undefined;
              if (item?.type === "function_call") {
                const idx = nextToolIdx++;
                toolIndices.set(item.id as string, idx);
                controller.enqueue(
                  encoder.encode(
                    chunk({
                      tool_calls: [{
                        index: idx,
                        id: item.call_id ?? item.id,
                        type: "function",
                        function: { name: item.name as string, arguments: "" },
                      }],
                    }),
                  ),
                );
              }
            } else if (type === "response.function_call_arguments.delta") {
              const d = evt.delta as string;
              if (d) {
                const idx = toolIndices.get(evt.item_id as string) ?? 0;
                controller.enqueue(
                  encoder.encode(
                    chunk({ tool_calls: [{ index: idx, function: { arguments: d } }] }),
                  ),
                );
              }
            } else if (type === "response.completed") {
              const resp = evt.response as Record<string, unknown> | undefined;
              if (resp) id = (resp.id as string) ?? id;
              const usage = resp?.usage as ResponsesUsage | undefined;
              if (usage) lifecycle.onUsage?.(usage);

              const final = {
                id,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                ...(usage && {
                  usage: {
                    prompt_tokens: usage.input_tokens ?? 0,
                    completion_tokens: usage.output_tokens ?? 0,
                    total_tokens: usage.total_tokens ?? 0,
                  },
                }),
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(final)}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              lifecycle.onComplete?.();
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
        lifecycle.onStreamClosed?.();
      }
    },
  });
}

// ─── Server ──────────────────────────────────────────────────────────────────

server = Bun.serve({
  port: PORT,

  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = (await req.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const body = sanitizeBody(parsed);
    const model = (body.model as string) ?? "gpt-5.4";
    const inputCount = Array.isArray(body.input) ? body.input.length : 0;
    const toolCount = Array.isArray(body.tools) ? body.tools.length : 0;
    const requestId = startRequest(model, inputCount, toolCount);

    const token = getAccessToken();
    if (!token) {
      markFailed(requestId, 401, "missing Codex token");
      return Response.json(
        { error: "No access token. Run `codex` to authenticate." },
        { status: 401 },
      );
    }

    let upstream: Response;
    try {
      upstream = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "upstream request failed";
      markFailed(requestId, 502, detail);
      return Response.json({ error: "Upstream request failed" }, { status: 502 });
    }

    if (!upstream.ok) {
      const text = await upstream.text();
      markFailed(requestId, upstream.status);
      return new Response(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    markStreaming(requestId, upstream.status);

    if (!upstream.body) {
      markFailed(requestId, 502, "empty upstream response");
      return Response.json({ error: "Empty upstream response" }, { status: 502 });
    }

    return new Response(responsesToCompletionsStream(upstream.body, model, {
      onUsage: (usage) => markUsage(requestId, usage),
      onComplete: () => markComplete(requestId),
      onStreamClosed: () => closeRequest(requestId),
    }), {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
});

// ─── Startup ─────────────────────────────────────────────────────────────────

setupKeyboard();
renderDashboard();

localtunnel({ port: PORT, subdomain: getSubdomain() })
  .then((nextTunnel) => {
    tunnel = nextTunnel;
    stats.tunnelUrl = nextTunnel.url;
    dashboardEvent("Tunnel ready");
  })
  .catch((err) => dashboardEvent(`Tunnel failed: ${err.message}`));
