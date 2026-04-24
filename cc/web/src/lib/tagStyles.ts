/** DaisyUI badge variants per tag (aligned with worker `TAGS`). */
const TAG_BADGE: Record<string, string> = {
  learning: "badge-info",
  tools: "badge-secondary",
  ideas: "badge-warning",
  people: "badge-success",
  opportunities: "badge-accent",
};

export function tagBadgeVariant(tag: string | null): string {
  if (!tag) return "badge-ghost";
  return TAG_BADGE[tag] ?? "badge-ghost";
}
