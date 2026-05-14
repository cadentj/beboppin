import type { Marker } from "./types";

export const STORAGE_KEY = "markers:v1" as const;

export type StoredMarkers = Record<string, Marker[]>;

function normalizeRecord(raw: unknown): StoredMarkers {
  if (!raw || typeof raw !== "object") return {};
  const out: StoredMarkers = {};
  for (const [vid, markers] of Object.entries(raw)) {
    if (!Array.isArray(markers)) continue;
    const list = markers.filter(
      (m): m is Marker =>
        m &&
        typeof m === "object" &&
        typeof (m as Marker).id === "string" &&
        typeof (m as Marker).videoId === "string" &&
        typeof (m as Marker).time === "number" &&
        typeof (m as Marker).createdAt === "number",
    );
    if (list.length) out[vid] = list;
  }
  return out;
}

async function readAll(): Promise<StoredMarkers> {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeRecord(res[STORAGE_KEY]);
}

async function writeAll(data: StoredMarkers): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

export async function listMarkers(videoId: string): Promise<Marker[]> {
  const all = await readAll();
  return [...(all[videoId] ?? [])].sort((a, b) => a.time - b.time || a.createdAt - b.createdAt);
}

export async function addMarker(marker: Marker): Promise<void> {
  const all = await readAll();
  const list = all[marker.videoId] ?? [];
  all[marker.videoId] = [...list, marker];
  await writeAll(all);
}

export async function deleteMarker(videoId: string, markerId: string): Promise<void> {
  const all = await readAll();
  const list = all[videoId];
  if (!list) return;
  const next = list.filter((m) => m.id !== markerId);
  if (next.length === 0) delete all[videoId];
  else all[videoId] = next;
  await writeAll(all);
}

export async function allMarkers(): Promise<StoredMarkers> {
  return readAll();
}

export function subscribeMarkersChanged(
  handler: (changes: chrome.storage.StorageChange) => void,
): () => void {
  const fn: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== "local") return;
    const c = changes[STORAGE_KEY];
    if (c) handler(c);
  };
  chrome.storage.onChanged.addListener(fn);
  return () => chrome.storage.onChanged.removeListener(fn);
}
