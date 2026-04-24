<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Thought } from "./api";

  let { thought }: { thought: Thought } = $props();

  let expanded = $state(false);
  let overflows = $state(false);
  let contentEl: HTMLDivElement | undefined = $state();

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
</script>

<div class="card bg-base-100 border border-base-300">
  <div class="card-body items-start p-3">
    <div class="flex w-full min-w-0 items-start gap-3">
      <div class="flex min-w-0 flex-4 basis-0 flex-col gap-2">
        <div class="relative">
          <div
            bind:this={contentEl}
            class="whitespace-pre-wrap text-sm overflow-hidden"
            style:max-height={expanded ? "none" : "8rem"}
          >
            {thought.content}
          </div>
          {#if overflows && !expanded}
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-base-100 to-transparent"
            ></div>
          {/if}
        </div>
        {#if overflows}
          <button type="button" class="btn btn-ghost btn-xs self-start" onclick={() => (expanded = !expanded)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        {/if}
      </div>
      <div class="flex min-w-0 flex-1 basis-0 flex-col items-end self-start text-right">
        <span class="text-xs whitespace-nowrap text-base-content/60">
          {new Date(thought.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  </div>
</div>
