<script lang="ts">
  import type { CuriusLink } from "./api";

  let { link }: { link: CuriusLink } = $props();
</script>

<div class="card bg-base-100 border border-base-300">
  <div class="card-body p-3 gap-2">
    <div class="flex items-center justify-between gap-2">
      <span class="badge badge-sm badge-ghost" title="saved via curius">curius</span>
      <span class="text-xs opacity-60 whitespace-nowrap">{new Date(link.created_at).toLocaleDateString()}</span>
    </div>
    <a href={link.url} target="_blank" rel="noreferrer" class="link link-primary break-words text-sm">
      {link.title ?? link.url}
    </a>
  </div>
</div>
