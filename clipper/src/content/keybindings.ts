function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (el.closest("[contenteditable='true'], [contenteditable='']")) return true;
  const role = el.getAttribute("role");
  return role === "textbox";
}

/** Drop marker on `s`/`S`; Shift+S reserved for notes (ignored for POC). */
export function attachMarkerKey(handler: () => void): () => void {
  const down = (e: KeyboardEvent): void => {
    if (e.key !== "s" && e.key !== "S") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isTypingTarget(document.activeElement)) return;
    e.preventDefault();
    handler();
  };
  window.addEventListener("keydown", down, true);
  return () => window.removeEventListener("keydown", down, true);
}
