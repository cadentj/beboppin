# ActivityWatch Productivity Analysis Guide

This guide is for future agents helping analyze Caden's ActivityWatch data. Keep the work lightweight. The useful output is usually a short Markdown report with observations and improvement ideas, not a big reusable tool.

## Goal

Help answer: **am I getting more frequent uninterrupted blocks of meaningful work?**

Do not optimize for exact accounting. Optimize for directional insight:

- How much active time happened recently?
- How much of it looked like work, study, writing, coding, or planning?
- How many uninterrupted focus blocks happened?
- What broke those blocks?
- What should Caden try next week?

## Data To Pull

ActivityWatch usually runs locally at:

```bash
http://localhost:5600/api/0
```

Start with these endpoints:

```bash
curl -s http://localhost:5600/api/0/info
curl -sL http://localhost:5600/api/0/buckets/
```

Look for:

- `aw-watcher-window_*`: app and window-title events.
- `aw-watcher-afk_*`: active vs AFK status.
- Browser URL buckets, if present. If no URL bucket exists, browser analysis can only use window titles and should be treated as approximate.

For a first pass, analyze the last 7 or 14 days.

## Recommended Analysis

Always intersect window events with `not-afk` intervals before drawing conclusions. This prevents lock screen, idle, or stale window time from inflating the report.

For focus blocks:

- Treat coding, terminal, notes, writing, docs, schoolwork, research, and deliberate planning as productive.
- Treat chat, social feeds, entertainment, and random browsing as interruptions or non-focus.
- Merge productive segments separated by very short gaps, around 1-2 minutes.
- End a focus block when nonproductive active time lasts more than about 30-60 seconds.
- Count blocks over 25, 45, and 90 minutes.

Avoid hand-building a giant taxonomy unless Caden explicitly asks for it. A small, transparent heuristic is enough. If classification is uncertain, say so.

## What To Report

Prefer a concise Markdown report with:

- Active hours by day.
- Productive hours by day.
- Number of focus blocks over 25, 45, and 90 minutes.
- Longest focus block per day.
- Top apps by active time.
- Approximate interruption sources.
- Clear caveats about browser-title-only analysis.
- 3-5 concrete improvement ideas.

Good improvement ideas are behavioral and testable:

- Protect one or two 45-minute blocks during the best time of day.
- Batch Slack/Messages checks after focus blocks.
- Close or separate social/feed tabs during work sessions.
- Add ActivityWatch browser URL tracking if browser activity is too ambiguous.
- Compare this week's focus-block count with next week's.

## Privacy

Do not dump raw window titles into the final report by default. Window titles may contain private messages, document names, or personal details.

It is fine to use titles locally for rough classification, but final output should summarize categories rather than list sensitive strings.

## Output Style

Keep it simple:

- A single `.md` report is enough.
- A small CSV or chart is optional only if it clearly helps compare focus blocks over time.
- Do not create a full dashboard or long script unless requested.
- If code is needed, prefer a short throwaway snippet in the conversation or a tiny local helper, not a permanent framework.

## Suggested Report Shape

```markdown
# Productivity Review

## Summary

- Active time:
- Productive time:
- Focus blocks >=25m:
- Focus blocks >=45m:
- Focus blocks >=90m:
- Longest block:

## Daily Trend

| Day | Active h | Productive h | >=25m | >=45m | Longest |
|---|---:|---:|---:|---:|---:|

## What Helped

## What Interrupted Focus

## Experiments For Next Week

## Caveats
```

The most useful recurring metric is not total work time. It is whether Caden is getting more **uninterrupted focus blocks** with fewer avoidable interruptions.
