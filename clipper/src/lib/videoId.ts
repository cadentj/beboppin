const WATCH_PATH = "/watch";

export function parseWatchVideoId(): string | null {
  if (typeof location === "undefined") return null;
  const url = new URL(location.href);
  if (url.pathname !== WATCH_PATH) return null;
  const id = url.searchParams.get("v");
  return id?.trim() || null;
}

/** Notifies watch page video id changes. Second arg is previous id (`null` on first emission). */
export function subscribeWatchVideoId(
  listener: (videoId: string | null, previous: string | null) => void,
): () => void {
  let previous: string | null | undefined;

  function emit(): void {
    const next = parseWatchVideoId();
    const old = previous === undefined ? null : previous;
    if (previous !== undefined && next === previous) return;
    previous = next;
    listener(next, old);
  }

  emit();

  document.addEventListener("yt-navigate-finish", emit);
  window.addEventListener("popstate", emit);

  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    emit();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  return () => {
    document.removeEventListener("yt-navigate-finish", emit);
    window.removeEventListener("popstate", emit);
    observer.disconnect();
  };
}
