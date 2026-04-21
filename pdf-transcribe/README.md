## pdf-transcribe

Small CLI for transcribing a PDF into LaTeX with the Gemini API.

It renders each PDF page to an image, sends pages to Gemini in parallel, and writes a single ordered `.tex` file.

### Setup

```bash
cd /Users/caden/Programming/beboppin/pdf-transcribe
uv sync
cp .env.template .env
```

Then put your Gemini API key in `.env`.

### Usage

Run:

```bash
uv run pdf-transcribe /Users/caden/Programming/beboppin/3527_final_extra_review_problems.pdf
```

Or specify output and concurrency:

```bash
uv run pdf-transcribe \
  /Users/caden/Programming/beboppin/3527_final_extra_review_problems.pdf \
  --output /Users/caden/Programming/beboppin/output.tex \
  --concurrency 10
```

### Notes

- Default model: `gemini-3.1-flash-lite-preview`
- Default concurrency: `8`
- Default render DPI: `200`
- Output defaults to the input filename with a `.tex` extension.
- The CLI loads `GEMINI_API_KEY` from a local `.env` file automatically.
- The script omits obvious scan headers and footers when Gemini can distinguish them from real content.
