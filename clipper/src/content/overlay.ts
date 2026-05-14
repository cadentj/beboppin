import type { Marker } from "../lib/types";
import { seekVideo } from "./player";

import "./styles.css";

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type OverlayApi = Readonly<{ update: (markers: Marker[]) => void }>;

/** Mount SoundCloud-style pins anchored to outer `.ytp-progress-bar`. */
export function mountMarkerOverlay(opts: Readonly<{ videoId: string; video: HTMLVideoElement; progressBar: HTMLElement }> & {
  /** Called when user deletes via context menu */
  onDelete: (markerId: string) => void;
}): { api: OverlayApi; unmount: () => void } {
  const pb = opts.progressBar;
  const pbComputed = window.getComputedStyle(pb);
  let bumpedPosition = false;
  let bumpedOverflow = false;
  if (pbComputed.position === "static") {
    pb.style.position = "relative";
    bumpedPosition = true;
  }
  if (pbComputed.overflow !== "visible") {
    pb.style.overflow = "visible";
    bumpedOverflow = true;
  }

  const root = document.createElement("div");
  root.className = "clipper-marker-root";
  root.setAttribute("data-clipper-root", "");
  root.setAttribute("data-clipper-video", opts.videoId);
  pb.prepend(root);

  root.style.left = "0";
  root.style.right = "0";
  root.style.width = "100%";

  let markers: Marker[] = [];

  function renderPins(): void {
    root.replaceChildren();

    const duration = opts.video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;

    for (const marker of [...markers].sort((a, b) => a.time - b.time)) {
      let pct = (marker.time / duration) * 100;
      if (!Number.isFinite(pct)) continue;
      pct = Math.min(100, Math.max(0, pct));

      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "clipper-marker-pin";
      pin.tabIndex = 0;
      pin.style.left = `${pct}%`;
      pin.setAttribute("aria-label", `Seek to ${formatMmSs(marker.time)}`);
      pin.setAttribute("data-clipper-marker", marker.id);

      const tip = document.createElement("div");
      tip.className = "clipper-marker-tooltip";
      tip.setAttribute("role", "tooltip");

      const timeLine = document.createElement("div");
      timeLine.className = "clipper-marker-time";
      timeLine.textContent = formatMmSs(marker.time);

      tip.append(timeLine);

      if (marker.note?.trim()) {
        const note = document.createElement("div");
        note.className = "clipper-marker-note";
        note.textContent = marker.note.trim();
        tip.append(note);
      }

      pin.append(tip);

      pin.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        seekVideo(opts.video, marker.time);
      });

      pin.addEventListener(
        "contextmenu",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          opts.onDelete(marker.id);
        },
        true,
      );

      root.append(pin);
    }
  }

  const onDuration = (): void => {
    renderPins();
  };

  opts.video.addEventListener("durationchange", onDuration);
  opts.video.addEventListener("loadedmetadata", onDuration);

  const api: OverlayApi = {
    update(next: Marker[]) {
      markers = next;
      renderPins();
    },
  };

  api.update([]);

  return {
    api,
    unmount: () => {
      opts.video.removeEventListener("durationchange", onDuration);
      opts.video.removeEventListener("loadedmetadata", onDuration);
      root.remove();
      if (bumpedPosition) pb.style.removeProperty("position");
      if (bumpedOverflow) pb.style.removeProperty("overflow");
    },
  };
}
