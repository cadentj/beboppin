"""Build charts for the open-model enforcement policy doc.

Run: uv run --with matplotlib governance/charts/build_charts.py

Reads governance/charts/data/provider_weekly_tokens.csv (weekly token volumes
per OpenRouter org, 2025-04-20 through 2026-04-19) and writes three PNGs to
governance/charts/.
"""

import csv
from datetime import date
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
CSV_PATH = HERE / "data" / "provider_weekly_tokens.csv"

# Org classifications. The provider CSV's column set is fixed at extraction
# time; if OpenRouter adds a new org later, re-check this mapping.
CHINESE_OPEN = ["deepseek", "qwen", "moonshotai", "z-ai", "minimax", "stepfun", "xiaomi"]
US_OPEN = ["meta-llama", "microsoft", "nousresearch", "arcee-ai"]
US_CLOSED = ["anthropic", "google", "openai", "x-ai"]
OTHER_OPEN = ["mistralai", "tngtech"]  # FR / DE; open weights but neither US nor CN

OPEN_ORGS = CHINESE_OPEN + US_OPEN + OTHER_OPEN
CLOSED_ORGS = US_CLOSED

STYLE = {"dpi": 150, "figsize": (10, 5.5)}
plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "font.size": 10,
})


def load_rows():
    with CSV_PATH.open() as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    # Drop the trailing week if its total is materially lower than the prior
    # week — OpenRouter's weekly buckets include a partial current week.
    tot = [int(r["total_tokens"]) for r in rows]
    if len(tot) >= 2 and tot[-1] < 0.85 * tot[-2]:
        rows = rows[:-1]
    dates = [date.fromisoformat(r["date"]) for r in rows]
    numeric_cols = [c for c in reader.fieldnames if c != "date"]
    data = {c: [int(r[c]) for r in rows] for c in numeric_cols}
    return dates, data


def bucket_sum(data, orgs, n):
    return [sum(data[o][i] for o in orgs if o in data) for i in range(n)]


def fmt_xaxis(ax):
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    for label in ax.get_xticklabels():
        label.set_rotation(0)


def human_tokens(n):
    for unit, div in [("T", 1e12), ("B", 1e9), ("M", 1e6)]:
        if n >= div:
            return f"{n/div:.2f}{unit}"
    return str(n)


def chart_open_vs_closed_share(dates, data):
    n = len(dates)
    open_tot = bucket_sum(data, OPEN_ORGS, n)
    closed_tot = bucket_sum(data, CLOSED_ORGS, n)
    other_tot = [data["others"][i] + data["openrouter"][i] for i in range(n)]
    total = [open_tot[i] + closed_tot[i] + other_tot[i] for i in range(n)]

    open_share = [100 * open_tot[i] / total[i] for i in range(n)]
    closed_share = [100 * closed_tot[i] / total[i] for i in range(n)]
    other_share = [100 * other_tot[i] / total[i] for i in range(n)]

    fig, ax = plt.subplots(**STYLE)
    ax.stackplot(
        dates,
        closed_share, open_share, other_share,
        labels=["Closed-weight (Anthropic, Google, OpenAI, xAI)",
                "Open-weight (all open-weight orgs)",
                "Other / router-internal"],
        colors=["#4C78A8", "#F58518", "#BAB0AC"],
        alpha=0.95,
    )
    ax.set_ylim(0, 100)
    ax.set_ylabel("Share of weekly tokens on OpenRouter (%)")
    ax.set_title("Open- vs closed-weight model share on OpenRouter, weekly")
    ax.legend(loc="lower left", frameon=False)
    fmt_xaxis(ax)
    fig.tight_layout()
    fig.savefig(HERE / "open_vs_closed_share.png", dpi=STYLE["dpi"])
    plt.close(fig)

    print(f"open-weight share: {open_share[0]:.1f}% -> {open_share[-1]:.1f}%")
    print(f"closed-weight share: {closed_share[0]:.1f}% -> {closed_share[-1]:.1f}%")


def chart_chinese_open_vs_us_closed(dates, data):
    # US open-weight (Llama, Phi) drops out of OpenRouter's top-N provider
    # tracking after late 2025 as Chinese labs take over the open-weight
    # slot, which makes a direct US-open vs CN-open chart hard to read. The
    # more policy-relevant comparison is Chinese open-weight share vs US
    # closed-weight frontier-lab share (Anthropic + OpenAI + Google + xAI).
    n = len(dates)
    cn_open = bucket_sum(data, CHINESE_OPEN, n)
    us_closed = bucket_sum(data, US_CLOSED, n)
    total = data["total_tokens"]

    cn_share = [100 * cn_open[i] / total[i] for i in range(n)]
    us_share = [100 * us_closed[i] / total[i] for i in range(n)]

    fig, ax = plt.subplots(**STYLE)
    ax.plot(dates, us_share, label="US closed-weight frontier labs",
            color="#4C78A8", linewidth=2.4)
    ax.plot(dates, cn_share, label="Chinese open-weight labs",
            color="#D62728", linewidth=2.4)
    ax.set_ylabel("Share of weekly tokens on OpenRouter (%)")
    ax.set_title("Chinese open-weight labs are closing on US frontier labs")
    ax.legend(loc="center left", frameon=False)
    ax.grid(True, axis="y", alpha=0.2)
    fmt_xaxis(ax)
    fig.tight_layout()
    fig.savefig(HERE / "chinese_open_vs_us_closed.png", dpi=STYLE["dpi"])
    plt.close(fig)

    print(f"Chinese open share: {cn_share[0]:.1f}% -> {cn_share[-1]:.1f}% "
          f"({human_tokens(cn_open[0])} -> {human_tokens(cn_open[-1])}, "
          f"{cn_open[-1]/max(cn_open[0],1):.1f}x)")
    print(f"US closed share:    {us_share[0]:.1f}% -> {us_share[-1]:.1f}% "
          f"({human_tokens(us_closed[0])} -> {human_tokens(us_closed[-1])}, "
          f"{us_closed[-1]/max(us_closed[0],1):.1f}x)")


def chart_chinese_open_breakdown(dates, data):
    n = len(dates)
    # Order by final-week volume so biggest sits on bottom of stack
    series = sorted(CHINESE_OPEN, key=lambda o: data[o][-1], reverse=True)
    values = [[v / 1e9 for v in data[o]] for o in series]

    fig, ax = plt.subplots(**STYLE)
    palette = ["#D62728", "#E377C2", "#FF7F0E", "#BCBD22", "#17BECF", "#9467BD", "#8C564B"]
    ax.stackplot(dates, *values, labels=series, colors=palette[:len(series)], alpha=0.95)
    ax.set_ylabel("Weekly tokens (billions)")
    ax.set_title("Chinese open-weight model usage on OpenRouter, by lab")
    ax.legend(loc="upper left", frameon=False, ncol=2)
    fmt_xaxis(ax)
    fig.tight_layout()
    fig.savefig(HERE / "chinese_open_breakdown.png", dpi=STYLE["dpi"])
    plt.close(fig)

    print("Chinese lab final-week volumes:")
    for o in series:
        print(f"  {o:12s} {human_tokens(data[o][-1])}")


def sanity_check(dates, data):
    # Weekly sum across orgs should equal total_tokens column
    n = len(dates)
    org_cols = [c for c in data if c != "total_tokens"]
    for i in range(n):
        s = sum(data[c][i] for c in org_cols)
        t = data["total_tokens"][i]
        assert abs(s - t) / max(t, 1) < 1e-9, f"mismatch at {dates[i]}: {s} vs {t}"
    print(f"sanity check passed across {n} weeks")


def main():
    dates, data = load_rows()
    sanity_check(dates, data)
    print()
    chart_open_vs_closed_share(dates, data)
    print()
    chart_chinese_open_vs_us_closed(dates, data)
    print()
    chart_chinese_open_breakdown(dates, data)


if __name__ == "__main__":
    main()
