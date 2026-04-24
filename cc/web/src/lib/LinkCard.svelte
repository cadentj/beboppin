<script lang="ts">
  import { patchLink, type LocalLink } from "./api";
  import { tagBadgeVariant } from "./tagStyles";

  let { link, tags }: { link: LocalLink; tags: string[] } = $props();

  let saving = $state<"idle" | "saving" | "error">("idle");

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
    <div class="flex items-center gap-2 flex-wrap">
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
