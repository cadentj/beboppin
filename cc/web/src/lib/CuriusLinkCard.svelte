<script lang="ts">
  import type { CuriusLink } from "./api";

  let { link }: { link: CuriusLink } = $props();
</script>

<div class="card bg-base-100 border border-base-300">
  <div class="card-body p-3 gap-2">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="badge badge-xs badge-ghost" title="saved via curius">curius</span>
      <a href={link.url} target="_blank" rel="noreferrer" class="link link-primary flex-1 min-w-0 truncate">
        {link.title ?? link.url}
      </a>
      <span class="text-xs opacity-60 whitespace-nowrap">{new Date(link.created_at).toLocaleDateString()}</span>
    </div>
  </div>
</div>
