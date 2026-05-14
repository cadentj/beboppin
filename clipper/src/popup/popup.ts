import { allMarkers, STORAGE_KEY } from "../lib/storage";
import "./popup.css";
import type { Marker } from "../lib/types";

function ytWatchUrl(videoId: string, timeSeconds: number): string {
  const t = Number.isFinite(timeSeconds)
    ? Math.max(0, Math.floor(timeSeconds))
    : 0;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${t}s`;
}

function flattenSorted(
  groups: Record<string, Marker[]>,
): { videoId: string; markers: Marker[] }[] {
  const entries = Object.entries(groups).map(([videoId, markers]) => ({
    videoId,
    markers: [...markers].sort((a, b) => b.createdAt - a.createdAt),
  }));
  return entries.sort((a, b) => {
    const aLast = a.markers[0]?.createdAt ?? 0;
    const bLast = b.markers[0]?.createdAt ?? 0;
    return bLast - aLast;
  });
}

async function render(): Promise<void> {
  const groups = await allMarkers();

  const root = document.getElementById("root");
  if (!root) return;

  root.replaceChildren();

  const grouped = flattenSorted(groups);

  if (grouped.length === 0) {
    const empty = document.createElement("p");
    empty.className = "clipper-popup-empty";
    empty.textContent = "No markers yet. Press S on a watch page.";
    root.append(empty);
    return;
  }

  for (const { videoId, markers } of grouped) {
    const section = document.createElement("section");
    section.className = "clipper-popup-section";

    const heading = document.createElement("h2");
    heading.className = "clipper-popup-heading";
    heading.textContent = videoId;
    section.append(heading);

    const list = document.createElement("ul");
    list.className = "clipper-popup-list";

    for (const marker of markers) {
      const li = document.createElement("li");

      const a = document.createElement("a");
      a.href = ytWatchUrl(videoId, marker.time);
      a.className = "clipper-popup-link";
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const timeBadge = document.createElement("span");
      timeBadge.className = "clipper-popup-time";
      const secs = Math.floor(marker.time);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      timeBadge.textContent = `${m}:${s.toString().padStart(2, "0")}`;

      a.append(timeBadge);

      if (marker.note?.trim()) {
        const span = document.createElement("span");
        span.className = "clipper-popup-note";
        span.textContent = marker.note.trim();
        a.append(span);
      }

      li.append(a);
      list.append(li);
    }

    section.append(list);
    root.append(section);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  void render();
});

void render();
