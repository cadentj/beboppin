const VIDEO_SELECTOR = "video.html5-main-video";
const PROGRESS_BAR_SELECTOR = ".ytp-progress-bar";

export type PlayerHandles = Readonly<{ video: HTMLVideoElement; progressBar: HTMLElement }>;

function qsVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
}

function qsBar(): HTMLElement | null {
  return document.querySelector<HTMLElement>(PROGRESS_BAR_SELECTOR);
}

export function resolvePlayerHandles(): PlayerHandles | null {
  const video = qsVideo();
  const progressBar = qsBar();
  if (!video || !progressBar) return null;
  return { video, progressBar };
}

/**
 * Retry until video + `.ytp-progress-bar` exist (YouTube SPA can mount them lazily).
 * Aborts via `AbortSignal`; returns `null` when aborted.
 */
export async function waitForPlayer(signal: AbortSignal): Promise<PlayerHandles | null> {
  const tryOnce = (): PlayerHandles | null => resolvePlayerHandles();
  const immediate = tryOnce();
  if (immediate) return immediate;

  return new Promise<PlayerHandles | null>((resolveResult) => {
    let settled = false;

    const settle = (value: PlayerHandles | null): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearInterval(interval);
      signal.removeEventListener("abort", onAbort);
      resolveResult(value);
    };

    function onAbort(): void {
      settle(null);
    }

    const observer = new MutationObserver(() => {
      if (signal.aborted) return;
      const handles = tryOnce();
      if (handles) settle(handles);
    });

    observer.observe(document.documentElement ?? document.body, {
      subtree: true,
      childList: true,
    });

    /** Slow poll covers cases where MutationObserver misses an update edge */
    const interval = window.setInterval(() => {
      if (signal.aborted) {
        settle(null);
        return;
      }
      const handles = tryOnce();
      if (handles) settle(handles);
    }, 280);

    signal.addEventListener("abort", onAbort, { once: true });

    if (signal.aborted) settle(null);
  });
}

export function seekVideo(video: HTMLVideoElement, timeSeconds: number): void {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return;
  video.currentTime = Math.min(timeSeconds, video.duration || Infinity);
}
