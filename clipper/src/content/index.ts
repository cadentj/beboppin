import {
  subscribeWatchVideoId,
  parseWatchVideoId,
} from "../lib/videoId";
import {
  addMarker,
  deleteMarker,
  listMarkers,
  subscribeMarkersChanged,
} from "../lib/storage";
import type { Marker } from "../lib/types";
import { waitForPlayer } from "./player";
import { attachMarkerKey } from "./keybindings";
import { mountMarkerOverlay } from "./overlay";

async function bootstrap(): Promise<void> {
  let activeSessionAbort: AbortController | null = null;
  let overlayApi: { update: (markers: Marker[]) => void } | null = null;
  let unmountOverlay: (() => void) | null = null;
  let unsubKeys: (() => void) | null = null;
  let unsubStorage: (() => void) | null = null;

  function clearUi(): void {
    unsubKeys?.();
    unsubKeys = null;
    unsubStorage?.();
    unsubStorage = null;
    unmountOverlay?.();
    unmountOverlay = null;
    overlayApi = null;
  }

  async function reloadMarkers(videoId: string): Promise<void> {
    if (parseWatchVideoId() !== videoId) return;
    const markers = await listMarkers(videoId);
    overlayApi?.update(markers);
  }

  async function activateVideoSession(videoId: string): Promise<void> {
    activeSessionAbort?.abort();
    activeSessionAbort = null;
    clearUi();

    const ac = new AbortController();
    activeSessionAbort = ac;

    const handles = await waitForPlayer(ac.signal);

    if (ac.signal.aborted) return;
    if (parseWatchVideoId() !== videoId) return;

    if (!handles) return;

    const { api, unmount } = mountMarkerOverlay({
      videoId,
      video: handles.video,
      progressBar: handles.progressBar,
      onDelete: (markerId) => {
        void deleteMarker(videoId, markerId).then(() => reloadMarkers(videoId));
      },
    });

    overlayApi = api;
    unmountOverlay = unmount;

    unsubKeys = attachMarkerKey(() => {
      void dropMarker(videoId, handles.video);
    });

    unsubStorage = subscribeMarkersChanged(() => {
      void reloadMarkers(videoId);
    });

    await reloadMarkers(videoId);
  }

  async function dropMarker(
    videoId: string,
    video: HTMLVideoElement,
  ): Promise<void> {
    if (parseWatchVideoId() !== videoId) return;
    const t = video.currentTime;
    if (!Number.isFinite(t) || t < 0) return;
    await addMarker({
      id: crypto.randomUUID(),
      videoId,
      time: t,
      createdAt: Date.now(),
    });
    await reloadMarkers(videoId);
  }

  subscribeWatchVideoId((videoId) => {
    if (!videoId) {
      activeSessionAbort?.abort();
      activeSessionAbort = null;
      clearUi();
      return;
    }
    void activateVideoSession(videoId);
  });
}

void bootstrap();
