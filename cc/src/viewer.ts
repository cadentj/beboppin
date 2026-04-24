import type { Env } from "./index";

type LinkRow = { id: number; url: string; notes: string; created_at: string };
type TranscriptRow = { id: number; transcript: string; created_at: string };

export async function renderViewer(request: Request, env: Env): Promise<Response> {
  if (env.WEB_AUTH_TOKEN && !isAuthorized(request, env.WEB_AUTH_TOKEN)) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }

  const [links, transcriptions] = await Promise.all([
    env.cc.prepare("SELECT id, url, notes, created_at FROM links ORDER BY created_at DESC LIMIT 200").all<LinkRow>(),
    env.cc.prepare("SELECT id, transcript, created_at FROM transcriptions ORDER BY created_at DESC LIMIT 100").all<TranscriptRow>(),
  ]);

  return new Response(renderHtml(links.results ?? [], transcriptions.results ?? []), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderHtml(links: LinkRow[], transcriptions: TranscriptRow[]): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>cc</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #f7f7f4; color: #1c1f24; }
    header { padding: 20px 24px; border-bottom: 1px solid #deded8; background: #fff; }
    h1 { margin: 0; font-size: 20px; }
    main { max-width: 860px; margin: 0 auto; padding: 20px; }
    section { margin-bottom: 32px; }
    h2 { font-size: 15px; margin: 0 0 10px; color: #606873; text-transform: uppercase; letter-spacing: 0.05em; }
    article { background: #fff; border: 1px solid #deded8; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
    a { color: #135dbd; overflow-wrap: anywhere; }
    .meta { color: #8a909b; font-size: 12px; margin-top: 6px; }
    pre { white-space: pre-wrap; font: inherit; margin: 8px 0 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #181a1f; color: #eceef2; }
      header, article { background: #20232a; border-color: #343842; }
      a { color: #8fbeff; }
      .meta { color: #a6adba; }
      h2 { color: #a6adba; }
    }
  </style>
</head>
<body>
  <header><h1>cc</h1></header>
  <main>
    <section>
      <h2>Links (${links.length})</h2>
      ${links.length === 0 ? "<article>none yet</article>" : links.map(renderLink).join("")}
    </section>
    <section>
      <h2>Transcriptions (${transcriptions.length})</h2>
      ${transcriptions.length === 0 ? "<article>none yet</article>" : transcriptions.map(renderTranscript).join("")}
    </section>
  </main>
</body>
</html>`;
}

function renderLink(row: LinkRow): string {
  return `<article>
    <a href="${escapeAttr(row.url)}" rel="noreferrer">${escapeHtml(row.url)}</a>
    ${row.notes ? `<pre>${escapeHtml(row.notes)}</pre>` : ""}
    <div class="meta">${escapeHtml(row.created_at)}</div>
  </article>`;
}

function renderTranscript(row: TranscriptRow): string {
  return `<article>
    <pre>${escapeHtml(row.transcript)}</pre>
    <div class="meta">${escapeHtml(row.created_at)}</div>
  </article>`;
}

function isAuthorized(request: Request, token: string): boolean {
  const url = new URL(request.url);
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === token || url.searchParams.get("token") === token;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
