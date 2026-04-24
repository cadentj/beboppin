<script lang="ts">
  import { patchLink, type LocalLink } from "./api";

  let { link, tags }: { link: LocalLink; tags: string[] } = $props();

  let saving = $state<"idle" | "saving" | "error">("idle");

  async function onTagChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    const next = value === "" ? null : value;
    saving = "saving";
    try {
      await patchLink(link.id, { tag: next });
      link.tag = next;
      saving = "idle";
    } catch {
      saving = "error";
    }
  }
</script>

<div class="card bg-base-100 border border-base-300">
  <div class="card-body p-3 gap-2">
    <div class="flex items-center gap-2 flex-wrap">
      <select
        class="select select-xs select-bordered"
        class:select-primary={link.tag}
        value={link.tag ?? ""}
        onchange={onTagChange}
      >
        <option value="">—</option>
        {#each tags as t (t)}
          <option value={t}>{t}</option>
        {/each}
      </select>
      <a href={link.url} target="_blank" rel="noreferrer" class="link link-primary flex-1 min-w-0 truncate">
        {link.url}
      </a>
      {#if saving === "saving"}
        <span class="loading loading-spinner loading-xs"></span>
      {:else if saving === "error"}
        <span class="text-error text-xs">failed</span>
      {/if}
      <span class="text-xs opacity-60 whitespace-nowrap">{new Date(link.created_at).toLocaleDateString()}</span>
    </div>
  </div>
</div>
