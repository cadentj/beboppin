<script lang="ts">
  import { onMount } from "svelte";
  import { fetchLinks, fetchTranscriptions, type Link, type Transcription } from "./lib/api";
  import LinkCard from "./lib/LinkCard.svelte";
  import CuriusLinkCard from "./lib/CuriusLinkCard.svelte";

  type Tab = "links" | "transcriptions";

  let tab = $state<Tab>("links");
  let links = $state<Link[]>([]);
  let tags = $state<string[]>([]);
  let transcriptions = $state<Transcription[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const [l, t] = await Promise.all([fetchLinks(), fetchTranscriptions()]);
      links = l.links;
      tags = l.tags;
      transcriptions = t.transcriptions;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  });
</script>

<div class="min-h-screen bg-base-200">
  <div class="navbar bg-base-100 border-b border-base-300">
    <div class="flex-1 px-2">
      <span class="text-xl font-semibold">cc</span>
    </div>
    <div role="tablist" class="tabs tabs-box">
      <button role="tab" class="tab" class:tab-active={tab === "links"} onclick={() => (tab = "links")}>
        Links <span class="badge badge-sm ml-2">{links.length}</span>
      </button>
      <button role="tab" class="tab" class:tab-active={tab === "transcriptions"} onclick={() => (tab = "transcriptions")}>
        Transcriptions <span class="badge badge-sm ml-2">{transcriptions.length}</span>
      </button>
    </div>
  </div>

  <main class="max-w-4xl mx-auto p-4">
    {#if loading}
      <div class="flex justify-center py-12"><span class="loading loading-spinner"></span></div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else if tab === "links"}
      {#if links.length === 0}
        <div class="text-center py-12 opacity-60">no links</div>
      {:else}
        <div class="space-y-2">
          {#each links as link (link.source + ":" + link.id)}
            {#if link.source === "curius"}
              <CuriusLinkCard {link} />
            {:else}
              <LinkCard {link} {tags} />
            {/if}
          {/each}
        </div>
      {/if}
    {:else if transcriptions.length === 0}
      <div class="text-center py-12 opacity-60">no transcriptions</div>
    {:else}
      <div class="space-y-2">
        {#each transcriptions as t (t.id)}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-4 gap-2">
              <p class="whitespace-pre-wrap">{t.transcript}</p>
              <div class="text-xs opacity-60">
                {new Date(t.created_at).toLocaleString()}
                {#if t.duration_seconds}· {t.duration_seconds}s{/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
