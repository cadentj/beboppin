import type { Env, LinkRow, TextRow } from "./types";

export async function renderViewer(request: Request, env: Env): Promise<Response> {
  if (env.WEB_AUTH_TOKEN && !isViewerAuthorized(request, env.WEB_AUTH_TOKEN)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const [links, thoughts, transcriptions] = await Promise.all([
    env.DB.prepare("SELECT id, url, tag, notes, raw_text, created_at FROM links ORDER BY created_at DESC LIMIT 100").all<LinkRow>(),
    env.DB.prepare("SELECT id, body, created_at FROM thoughts ORDER BY created_at DESC LIMIT 50").all<TextRow>(),
    env.DB.prepare("SELECT id, transcript, created_at FROM transcriptions ORDER BY created_at DESC LIMIT 50").all<TextRow>(),
  ]);

  return new Response(renderHtml(links.results ?? [], thoughts.results ?? [], transcriptions.results ?? []), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderHtml(links: LinkRow[], thoughts: TextRow[], transcriptions: TextRow[]): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>cc</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f7f4; color: #1c1f24; }
    header { padding: 24px; border-bottom: 1px solid #deded8; background: #ffffff; position: sticky; top: 0; }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    nav { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    nav a { color: #1c1f24; border: 1px solid #cfcfc8; padding: 7px 10px; border-radius: 6px; text-decoration: none; font-size: 14px; background: #fbfbf8; }
    main { max-width: 980px; margin: 0 auto; padding: 22px; }
    section { margin: 0 0 34px; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    article { background: #fff; border: 1px solid #deded8; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    a { color: #135dbd; overflow-wrap: anywhere; }
    .meta { color: #606873; font-size: 13px; margin-top: 8px; }
    .tag { display: inline-block; font-size: 12px; border: 1px solid #c8d3e8; color: #244f8f; background: #eef4ff; padding: 2px 7px; border-radius: 999px; margin-right: 8px; }
    pre { white-space: pre-wrap; font: inherit; margin: 10px 0 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #181a1f; color: #eceef2; }
      header, article { background: #20232a; border-color: #343842; }
      nav a { background: #252932; border-color: #3a404b; color: #eceef2; }
      a { color: #8fbeff; }
      .meta { color: #a6adba; }
      .tag { background: #213454; border-color: #35527d; color: #c8ddff; }
    }
  </style>
</head>
<body>
  <header>
    <h1>cc</h1>
    <nav>
      <a href="#links">Links (${links.length})</a>
      <a href="#thoughts">Thoughts (${thoughts.length})</a>
      <a href="#transcriptions">Transcriptions (${transcriptions.length})</a>
    </nav>
  </header>
  <main>
    <section id="links">
      <h2>Links</h2>
      ${renderLinks(links)}
    </section>
    <section id="thoughts">
      <h2>Thoughts</h2>
      ${renderTextRows(thoughts, "body")}
    </section>
    <section id="transcriptions">
      <h2>Transcriptions</h2>
      ${renderTextRows(transcriptions, "transcript")}
    </section>
  </main>
</body>
</html>`;
}

function renderLinks(rows: LinkRow[]): string {
  if (rows.length === 0) return "<article>No links yet.</article>";
  return rows
    .map(
      (row) => `<article>
        <div><span class="tag">#${escapeHtml(row.tag)}</span><a href="${escapeAttribute(row.url)}" rel="noreferrer">${escapeHtml(row.url)}</a></div>
        ${row.notes ? `<pre>${escapeHtml(row.notes)}</pre>` : ""}
        <div class="meta">${escapeHtml(row.created_at)}</div>
      </article>`,
    )
    .join("");
}

function renderTextRows(rows: TextRow[], key: "body" | "transcript"): string {
  if (rows.length === 0) return "<article>Nothing saved yet.</article>";
  return rows
    .map(
      (row) => `<article>
        <pre>${escapeHtml(row[key] ?? "")}</pre>
        <div class="meta">${escapeHtml(row.created_at)}</div>
      </article>`,
    )
    .join("");
}

function isViewerAuthorized(request: Request, token: string): boolean {
  const url = new URL(request.url);
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === token || url.searchParams.get("token") === token;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
