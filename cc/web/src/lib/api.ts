const TOKEN_KEY = "cc_token";

function readToken(): string {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("token");
  if (fromUrl) {
    localStorage.setItem(TOKEN_KEY, fromUrl);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
    return fromUrl;
  }
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export const token = readToken();

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

export type LocalLink = {
  source: "local";
  id: number;
  url: string;
  tag: string | null;
  created_at: string;
};

export type CuriusLink = {
  source: "curius";
  id: number;
  url: string;
  title: string | null;
  snippet: string | null;
  created_at: string;
};

export type Thought = {
  source: "thought";
  id: number;
  content: string;
  created_at: string;
};

export type Link = LocalLink | CuriusLink | Thought;

export type Transcription = {
  id: number;
  transcript: string;
  duration_seconds: number | null;
  created_at: string;
};

export async function fetchLinks(): Promise<{ links: Link[]; tags: string[] }> {
  const res = await fetch("/api/links", { headers: authHeaders() });
  if (!res.ok) throw new Error(`links: ${res.status}`);
  return res.json();
}

export async function fetchTranscriptions(): Promise<{ transcriptions: Transcription[] }> {
  const res = await fetch("/api/transcriptions", { headers: authHeaders() });
  if (!res.ok) throw new Error(`transcriptions: ${res.status}`);
  return res.json();
}

export async function patchLink(id: number, patch: { tag?: string | null }): Promise<void> {
  const res = await fetch(`/api/links/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch: ${res.status} ${await res.text()}`);
}
