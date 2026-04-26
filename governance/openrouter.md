# OpenRouter Rankings Reverse-Engineered API Guide

This guide describes the OpenRouter rankings data transport as observed from the live `https://openrouter.ai/rankings` page on April 23, 2026. It is intended as a handoff document for another model or engineer that needs to pull the same data and build graphs from it.

## Executive Summary

OpenRouter rankings data is not exposed as a normal public JSON REST endpoint.

The rankings page uses a Next.js React Server Component transport instead:

- URL pattern: `https://openrouter.ai/rankings?_rsc=<token>`
- Required request header: `RSC: 1`
- Response content type: `text/x-component`

If you request the same URL without the `RSC: 1` header, OpenRouter returns full HTML instead of the structured RSC payload.

The `_rsc` query token is ephemeral. It changes per page load or render cycle and should not be treated as stable.

## Important Constraints

The current public rankings payload does not appear to expose two full years of history.

What is currently available from the rankings payload:

- Provider weekly token history: approximately `2025-04-20` through `2026-04-19`
- Top-model weekly token history: approximately `2026-01-26` through `2026-04-20`
- Current weekly leaderboard rows with detailed token/request metrics

So:

- Provider-level growth over roughly one year: available
- Top-model weekly history: available, but much shorter
- Full two-year provider/model panel: not observed in the public rankings payload

## Core Endpoint

Use:

```http
GET /rankings?_rsc=<token>
Host: openrouter.ai
RSC: 1
```

Example:

```bash
curl -s \
  -H 'RSC: 1' \
  -H 'User-Agent: Mozilla/5.0' \
  'https://openrouter.ai/rankings?_rsc=d78lg'
```

Observed behavior:

- With `RSC: 1`, response is `text/x-component`
- Without `RSC: 1`, response is HTML
- `Next-Url: /rankings` was not required in my tests

## Response Format

The response is a React Flight / RSC stream, not plain JSON.

It looks like this at the top:

```text
1:"$Sreact.fragment"
2:I[76332,[...],"GoogleAnalytics"]
...
45:["$","$L55",null,{"rankingData":[...]}]
46:["$","$L52",null,{"children":["$","$L54",null,{"data":[...]}]}]
```

That means:

- The payload is line-oriented
- Many lines are component/module references
- The useful chart data is embedded as JSON arrays inside specific payload fragments
- The numeric line labels like `45:` or `46:` are not stable and should not be hard-coded

## What To Parse

Instead of hard-coding line numbers, scan the RSC payload for specific JSON shapes.

### 1. Provider Weekly Token History

Look for a JSON block after a `"data":` marker where each row looks like:

```json
{
  "x": "2025-04-20",
  "ys": {
    "google": 302870914566,
    "anthropic": 175184511431,
    "deepseek": 96204955539,
    "openai": 48089931212,
    "others": 18155239502
  }
}
```

Identification rule:

- Row has keys `x` and `ys`
- `ys` keys are provider names like `google`, `anthropic`, `openai`
- Provider names do not contain `/`

This is the best source for provider growth charts.

### 2. Top Models Weekly Token History

Look for another JSON block after a `"data":` marker where rows also have `x` and `ys`, but the `ys` keys are model identifiers like:

```json
{
  "x": "2025-05-19",
  "ys": {
    "openai/gpt-4o-mini": 47368327200,
    "anthropic/claude-3-7-sonnet-20250219": 30431479200,
    "google/gemini-2.5-flash-preview-05-20": 26869543200,
    "Others": 17933688000
  }
}
```

Identification rule:

- Row has keys `x` and `ys`
- At least some `ys` keys contain `/`

This is the best source for stacked or multi-line model history charts.

### 3. Weekly Leaderboard Raw Rows

Look for a JSON block after a `"rankingData":` marker where each row looks like:

```json
{
  "date": "2026-04-22 00:00:00",
  "model_permaslug": "anthropic/claude-4.7-opus-20260416",
  "variant": "standard",
  "total_completion_tokens": 6855002574,
  "total_prompt_tokens": 747322408560,
  "total_native_tokens_reasoning": 31826683,
  "count": 9340727,
  "num_media_prompt": 676321,
  "num_media_completion": 0,
  "num_audio_prompt": 0,
  "total_native_tokens_cached": 142910078918,
  "total_tool_calls": 1555855,
  "requests_with_tool_call_errors": 7749,
  "variant_permaslug": "anthropic/claude-4.7-opus-20260416",
  "change": null
}
```

This is the best source for:

- Current ranking tables
- Token mix analysis
- Request counts
- Tool-call intensity
- Cached-token analysis

## Recommended Parsing Strategy

Do not try to parse the full RSC protocol semantically. You do not need a full React Flight decoder for this task.

A simpler and more robust method:

1. Fetch the payload with `RSC: 1`
2. Search for occurrences of `"rankingData":`
3. Search for occurrences of `"data":`
4. For each occurrence, parse the first valid JSON array or object that follows
5. Classify each parsed block by shape:
   - `rankingData` block: array of leaderboard rows
   - `data` block with provider keys: provider weekly history
   - `data` block with model slug keys: model weekly history

## Shape-Based Classification Rules

Use these rules in order:

### Leaderboard Block

Array where first row contains:

- `date`
- `model_permaslug`
- `total_prompt_tokens`

### Provider Weekly History Block

Array where first row contains:

- `x`
- `ys`

and most `ys` keys look like:

- `anthropic`
- `google`
- `openai`
- `deepseek`
- `others`

### Model Weekly History Block

Array where first row contains:

- `x`
- `ys`

and at least one `ys` key contains `/`, for example:

- `openai/gpt-4o-mini`
- `anthropic/claude-4-sonnet-20250522`

## Stability Notes

The following are unstable:

- The `_rsc` token
- Numeric RSC line IDs like `45:` and `46:`
- Internal `$L54`-style component references

The following were stable enough to rely on during testing:

- `RSC: 1` header requirement
- Presence of provider weekly history in a `"data"` block
- Presence of model weekly history in another `"data"` block
- Presence of leaderboard rows in a `"rankingData"` block

## Data Ranges Observed

Observed on April 23, 2026:

- Provider weekly history had 53 weekly rows
- First provider week: `2025-04-20`
- Last provider week: `2026-04-19`
- Top-model weekly history had 13 weekly rows
- First top-model week: `2026-01-26`
- Last top-model week: `2026-04-20`
- Weekly leaderboard raw data had 385 rows

## Example Provider Growth Numbers

Using the extracted provider weekly series:

- `anthropic`: `175,184,511,431` -> `2,739,262,478,879`
- `google`: `302,870,914,566` -> `2,581,262,464,606`
- `openai`: `48,089,931,212` -> `1,937,172,260,746`
- `deepseek`: `96,204,955,539` -> `1,114,733,007,842`

Approximate growth multiples:

- `anthropic`: `15.64x`
- `google`: `8.52x`
- `openai`: `40.28x`
- `deepseek`: `11.59x`

## Suggested Graphs

For another model, these are the highest-value graphs to build from the extracted data:

### Provider Graphs

- Stacked area chart of weekly provider tokens
- Line chart of top 5 providers over time
- Share-of-total provider chart per week
- Growth-multiple bar chart from first to last available week

### Model Graphs

- Stacked area chart of top models across the available 13-week model-history window
- Small multiples for top 10 model lines
- Model turnover chart showing entries and exits from the top set

### Leaderboard / Usage Mix Graphs

- Scatter plot: prompt tokens vs completion tokens by model
- Bubble chart: requests vs total tokens
- Bar chart: total tool calls by model
- Cached-token ratio by model

## Caveats For Downstream Analysis

Another model should be aware of these caveats:

- Provider history and model history do not cover the same date range
- The model-history block appears to contain only a top subset, not all models
- The leaderboard raw rows are a current-period dataset, not a weekly time series
- Some chart blocks include `Others`, which should usually be preserved for stacked charts
- Provider names and model slugs can change over time as new releases appear

## Minimal Extraction Pseudocode

```python
text = fetch_rsc()

leaderboard = parse_json_after('"rankingData":', text)

candidate_data_blocks = parse_all_json_after('"data":', text)

provider_weekly = None
model_weekly = None

for block in candidate_data_blocks:
    if not isinstance(block, list) or not block:
        continue
    row0 = block[0]
    if not isinstance(row0, dict):
        continue
    if "x" in row0 and "ys" in row0:
        keys = row0["ys"].keys()
        if any("/" in k for k in keys):
            model_weekly = block
        else:
            provider_weekly = block
```

## Local Files Produced From This Reverse Engineering

These local files already exist from the extraction work:

- `/Users/caden/Documents/Codex/2026-04-23-hey-can-you-visit-openrouter-alr/out/rankings.rsc`
- `/Users/caden/Documents/Codex/2026-04-23-hey-can-you-visit-openrouter-alr/out/provider_weekly_tokens.csv`
- `/Users/caden/Documents/Codex/2026-04-23-hey-can-you-visit-openrouter-alr/out/top_models_weekly_tokens.csv`
- `/Users/caden/Documents/Codex/2026-04-23-hey-can-you-visit-openrouter-alr/out/leaderboard_week.json`
- `/Users/caden/Documents/Codex/2026-04-23-hey-can-you-visit-openrouter-alr/openrouter_rankings_extract.py`

## Best Prompt To Give Another Model

Use this:

```text
Use the OpenRouter rankings reverse-engineered transport, not the public HTML page.

Fetch:
GET https://openrouter.ai/rankings?_rsc=<fresh token>
Header: RSC: 1

Parse the RSC payload by shape, not by line number:
- leaderboard block: JSON after "rankingData":
- provider weekly history: a "data" block where each row is {"x": ..., "ys": {...provider names...}}
- model weekly history: a "data" block where each row is {"x": ..., "ys": {...model slugs with / ...}}

Use provider_weekly_tokens.csv and top_models_weekly_tokens.csv if available locally.

Build:
1. stacked area chart of weekly provider tokens
2. top-provider line chart
3. provider market-share-over-time chart
4. stacked area chart of top model tokens over the available model-history window

Be explicit that provider history starts around 2025-04-20 and model history starts around 2026-01-26, so there is not a full two-year public dataset in the rankings payload.
```
