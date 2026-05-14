<script lang="ts">
  import { onMount, tick } from "svelte";
  import { patchLink, type LocalLink } from "./api";
  import { tagBadgeVariant } from "./tagStyles";

  let { link, tags }: { link: LocalLink; tags: string[] } = $props();

  let saving = $state<"idle" | "saving" | "error">("idle");
  let expanded = $state(false);
  let overflows = $state(false);
  let contentEl: HTMLDivElement | undefined = $state();

  type ContentPart = { kind: "text"; text: string } | { kind: "url"; text: string; href: string };

  const URL_PATTERN = /https?:\/\/\S+/gi;

  function linkifyContent(value: string): ContentPart[] {
    const parts: ContentPart[] = [];
    let lastIndex = 0;

    for (const match of value.matchAll(URL_PATTERN)) {
      const raw = match[0];
      const start = match.index ?? 0;
      const trailing = raw.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const urlText = trailing ? raw.slice(0, -trailing.length) : raw;

      if (start > lastIndex) {
        parts.push({ kind: "text", text: value.slice(lastIndex, start) });
      }
      if (urlText) {
        parts.push({ kind: "url", text: urlText, href: urlText });
      }
      if (trailing) {
        parts.push({ kind: "text", text: trailing });
      }
      lastIndex = start + raw.length;
    }

    if (lastIndex < value.length) {
      parts.push({ kind: "text", text: value.slice(lastIndex) });
    }
    return parts.length ? parts : [{ kind: "text", text: value }];
  }

  async function measure() {
    await tick();
    if (!contentEl) return;
    const prev = expanded;
    expanded = false;
    await tick();
    overflows = contentEl.scrollHeight > contentEl.clientHeight + 1;
    expanded = prev;
  }

  onMount(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (contentEl) ro.observe(contentEl);
    return () => ro.disconnect();
  });

  async function setTag(next: string | null) {
    saving = "saving";
    try {
      await patchLink(link.id, { tag: next });
      link.tag = next;
      saving = "idle";
    } catch {
      saving = "error";
    }
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
</script>

<div class="card bg-base-100 border border-base-300">
  <div class="card-body p-3 gap-2">
    <div class="flex items-center justify-between gap-2">
      <div class="dropdown dropdown-start">
        <div
          tabindex="0"
          role="button"
          class="badge badge-sm cursor-pointer {tagBadgeVariant(link.tag)}"
        >
          {link.tag ?? "—"}
        </div>
        <ul
          tabindex="-1"
          class="menu dropdown-content z-1 mt-1 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-sm"
        >
          <li>
            <button type="button" class="text-xs" onclick={() => setTag(null)}>
              <span class="badge badge-xs badge-ghost">—</span>
            </button>
          </li>
          {#each tags as t (t)}
            <li>
              <button type="button" class="text-xs" onclick={() => setTag(t)}>
                <span class="badge badge-xs {tagBadgeVariant(t)}">{t}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
      <div class="flex items-center gap-2">
        {#if saving === "saving"}
          <span class="loading loading-spinner loading-xs"></span>
        {:else if saving === "error"}
          <span class="text-error text-xs">failed</span>
        {/if}
        <span class="text-xs opacity-60 whitespace-nowrap">{new Date(link.created_at).toLocaleDateString()}</span>
      </div>
    </div>
    <div class="relative">
      <div
        bind:this={contentEl}
        class="whitespace-pre-wrap break-words text-sm overflow-hidden"
        style:max-height={expanded ? "none" : "8rem"}
      >
        {#each linkifyContent(link.content) as part}
          {#if part.kind === "url"}
            <a href={part.href} target="_blank" rel="noreferrer" class="link link-primary">{part.text}</a>
          {:else}
            {part.text}
          {/if}
        {/each}
      </div>
      {#if overflows && !expanded}
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-base-100 to-transparent"></div>
      {/if}
    </div>
    {#if overflows}
      <button type="button" class="btn btn-ghost btn-xs self-start" onclick={() => (expanded = !expanded)}>
        {expanded ? "Show less" : "Show more"}
      </button>
    {/if}
  </div>
</div>
