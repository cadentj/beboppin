from __future__ import annotations

import argparse
import asyncio
import os
import re
from dataclasses import dataclass
from pathlib import Path

import fitz
from google import genai
from google.genai import types
from dotenv import load_dotenv

DEFAULT_MODEL = "gemini-3.1-flash-lite-preview"
DEFAULT_CONCURRENCY = 8
DEFAULT_DPI = 200
DEFAULT_RETRIES = 3

SYSTEM_PROMPT = """You are transcribing one page of an academic PDF into LaTeX.

Rules:
- Return LaTeX only for the page body content.
- Do not wrap the answer in markdown fences.
- Do not add a document preamble or \\begin{document}.
- Do not include \\documentclass, \\usepackage, \\title, \\author, \\date, \\maketitle, \\begin{document}, or \\end{document}.
- Preserve section headings, paragraphs, lists, equations, tables, and figure captions when present.
- Use standard LaTeX constructs. Prefer simple, valid LaTeX over exotic packages.
- If the page has page numbers, headers, or footers that are clearly part of the scan rather than content, omit them.
- If a symbol or word is ambiguous, make the best faithful guess instead of inserting notes.
"""


@dataclass(frozen=True)
class PageJob:
    page_number: int
    image_bytes: bytes


LATEX_WRAPPER_PATTERNS = [
    r"\\documentclass(?:\[[^\]]*\])?\{[^}]*\}",
    r"\\usepackage(?:\[[^\]]*\])?\{[^}]*\}",
    r"\\title\{[^}]*\}",
    r"\\author\{[^}]*\}",
    r"\\date\{[^}]*\}",
    r"\\maketitle",
    r"\\begin\{document\}",
    r"\\end\{document\}",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transcribe a PDF into LaTeX by sending rendered pages to Gemini."
    )
    parser.add_argument("input_pdf", type=Path, help="Path to the source PDF.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Path to the output .tex file. Defaults to <input>.tex",
    )
    parser.add_argument(
        "--api-key",
        help="Gemini API key. Defaults to GEMINI_API_KEY from the environment.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Gemini model to use. Default: {DEFAULT_MODEL}",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help=f"Maximum number of pages to transcribe in parallel. Default: {DEFAULT_CONCURRENCY}",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=DEFAULT_DPI,
        help=f"Render DPI for each page image. Default: {DEFAULT_DPI}",
    )
    parser.add_argument(
        "--start-page",
        type=int,
        default=1,
        help="1-based first page to transcribe. Default: 1",
    )
    parser.add_argument(
        "--end-page",
        type=int,
        help="1-based last page to transcribe. Defaults to the final page.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=DEFAULT_RETRIES,
        help=f"Retries per page on transient failures. Default: {DEFAULT_RETRIES}",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> tuple[Path, Path, str]:
    load_dotenv()
    input_pdf = args.input_pdf.expanduser().resolve()
    if not input_pdf.is_file():
        raise SystemExit(f"Input PDF does not exist: {input_pdf}")
    if input_pdf.suffix.lower() != ".pdf":
        raise SystemExit(f"Input file is not a PDF: {input_pdf}")

    output = args.output.expanduser().resolve() if args.output else input_pdf.with_suffix(".tex")
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Missing Gemini API key. Pass --api-key or set GEMINI_API_KEY.")
    if args.concurrency < 1:
        raise SystemExit("--concurrency must be at least 1.")
    if args.dpi < 72:
        raise SystemExit("--dpi should be at least 72.")
    if args.start_page < 1:
        raise SystemExit("--start-page must be at least 1.")
    if args.end_page is not None and args.end_page < args.start_page:
        raise SystemExit("--end-page must be greater than or equal to --start-page.")
    if args.retries < 0:
        raise SystemExit("--retries must be non-negative.")

    return input_pdf, output, api_key


def render_pages(input_pdf: Path, dpi: int, start_page: int, end_page: int | None) -> list[PageJob]:
    document = fitz.open(input_pdf)
    try:
        total_pages = document.page_count
        final_page = end_page or total_pages
        if start_page > total_pages:
            raise SystemExit(
                f"--start-page {start_page} is beyond the end of the PDF ({total_pages} pages)."
            )
        if final_page > total_pages:
            raise SystemExit(
                f"--end-page {final_page} is beyond the end of the PDF ({total_pages} pages)."
            )

        scale = dpi / 72
        matrix = fitz.Matrix(scale, scale)
        jobs: list[PageJob] = []
        for page_index in range(start_page - 1, final_page):
            page = document.load_page(page_index)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            jobs.append(
                PageJob(
                    page_number=page_index + 1,
                    image_bytes=pixmap.tobytes("png"),
                )
            )
        return jobs
    finally:
        document.close()


async def transcribe_page(
    client,
    job: PageJob,
    model: str,
    retries: int,
    semaphore: asyncio.Semaphore,
) -> tuple[int, str]:
    prompt = (
        f"Transcribe PDF page {job.page_number} into LaTeX. "
        "Return only the LaTeX for this page."
    )

    async with semaphore:
        for attempt in range(retries + 1):
            try:
                response = await client.models.generate_content(
                    model=model,
                    contents=[
                        prompt,
                        types.Part.from_bytes(data=job.image_bytes, mime_type="image/png"),
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0,
                        top_p=0.95,
                        max_output_tokens=8192,
                    ),
                )
                text = (response.text or "").strip()
                if not text:
                    raise RuntimeError("Gemini returned an empty response.")
                print(f"Transcribed page {job.page_number}")
                return job.page_number, text
            except Exception as exc:
                if attempt >= retries:
                    raise RuntimeError(
                        f"Failed to transcribe page {job.page_number} after {retries + 1} attempts."
                    ) from exc
                backoff_seconds = 2**attempt
                print(
                    f"Retrying page {job.page_number} after error: {exc} "
                    f"(attempt {attempt + 2}/{retries + 1})"
                )
                await asyncio.sleep(backoff_seconds)

    raise AssertionError("unreachable")


def sanitize_page_latex(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:latex)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    for pattern in LATEX_WRAPPER_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned)
    return cleaned.strip()


def assemble_document(input_pdf: Path, pages: list[tuple[int, str]]) -> str:
    ordered_pages = sorted(pages, key=lambda item: item[0])
    body = "\n\n".join(
        f"% Page {page_number}\n{sanitize_page_latex(page_text)}"
        for page_number, page_text in ordered_pages
    )
    title = input_pdf.stem.replace("_", " ")
    return (
        "\\documentclass{article}\n"
        "\\usepackage[utf8]{inputenc}\n"
        "\\usepackage[T1]{fontenc}\n"
        "\\usepackage{amsmath}\n"
        "\\usepackage{amssymb}\n"
        "\\usepackage{graphicx}\n"
        "\\usepackage{booktabs}\n"
        "\\usepackage{longtable}\n"
        "\\usepackage{hyperref}\n"
        "\\begin{document}\n"
        f"\\title{{{title}}}\n"
        "\\maketitle\n\n"
        f"{body}\n"
        "\\end{document}\n"
    )


async def run() -> None:
    args = parse_args()
    input_pdf, output, api_key = validate_args(args)
    page_jobs = render_pages(
        input_pdf=input_pdf,
        dpi=args.dpi,
        start_page=args.start_page,
        end_page=args.end_page,
    )
    print(f"Prepared {len(page_jobs)} page(s) from {input_pdf}")

    semaphore = asyncio.Semaphore(args.concurrency)
    async with genai.Client(api_key=api_key).aio as client:
        pages = await asyncio.gather(
            *[
                transcribe_page(
                    client=client,
                    job=job,
                    model=args.model,
                    retries=args.retries,
                    semaphore=semaphore,
                )
                for job in page_jobs
            ]
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(assemble_document(input_pdf, pages), encoding="utf-8")
    print(f"Wrote LaTeX to {output}")


def main() -> None:
    asyncio.run(run())
