"""
Generate full Persian doc HTML from Markdown (Chat-Box docs).
Output matches the structure of 01-PRD.html / 02-ARCHITECTURE.html:
sidebar (shared nav + per-page TOC), main content, doc-nav, optional Mermaid.

Usage (from repo root):
  python docs/scripts/build_doc_html.py
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1]

# Hand-authored HTML (do not overwrite by default): 01-PRD, 02-ARCHITECTURE
HAND_AUTHORED = frozenset({"01-PRD", "02-ARCHITECTURE"})

# (md_stem, emoji, browser_title_suffix)
DOCS_ORDER: list[tuple[str, str, str]] = [
    ("00-GOVERNANCE-ROLES", "⚖️", "حکمرانی و نقش‌ها"),
    ("01-PRD", "📋", "PRD"),
    ("02-ARCHITECTURE", "🏗️", "معماری سیستم"),
    ("03-TECH-STACK", "🧰", "Tech Stack"),
    ("04-DATABASE-SCHEMA", "🗄️", "Schema دیتابیس"),
    ("05-API-SPEC", "🔌", "API"),
    ("06-AI-ARCHITECTURE", "🤖", "معماری AI"),
    ("07-PROJECT-STRUCTURE", "📁", "ساختار پروژه"),
    ("08-ROADMAP", "🗺️", "Roadmap"),
    ("09-AI-AGENT-GUIDE", "🤖", "راهنمای AI Agent"),
    ("10-GTM-PRICING-MARKETING", "📣", "GTM و قیمت‌گذاری"),
    ("11-SECURITY-PRIVACY", "🔐", "امنیت و حریم خصوصی"),
    ("12-OPERATIONS-SUPPORT", "🛠️", "عملیات و پشتیبانی"),
    ("13-ARCHITECTURE-DECISION-RECORDS", "📝", "ADR"),
    ("14-INFRASTRUCTURE", "🖥️", "زیرساخت و سرورها"),
    ("15-DEVELOPMENT-GUIDE-FA", "📘", "راهنمای توسعه فارسی"),
    ("16-DEVELOPMENT-STATUS", "📊", "وضعیت مراحل توسعه"),
]

STEM_TO_NUM_FA = {}
for i, (s, _, _) in enumerate(DOCS_ORDER):
    fa = "۰۱۲۳۴۵۶۷۸۹"
    STEM_TO_NUM_FA[s] = fa[i // 10] + fa[i % 10]


def sidebar_nav_html(active_stem: str) -> str:
    lines: list[str] = []
    lines.append('    <a class="brand" href="index.html">')
    lines.append('      <span class="brand-logo">CB</span>')
    lines.append('      <span>Chat-Box Docs</span>')
    lines.append('    </a>')
    lines.append('')
    lines.append('    <h2>شروع</h2>')
    lines.append('    <nav>')
    lines.append('      <a href="index.html"><span class="num">🏠</span> خانه</a>')
    lines.append('    </nav>')
    lines.append('')
    lines.append('    <h2>حکمرانی</h2>')
    lines.append('    <nav>')
    g = "00-GOVERNANCE-ROLES.html"
    ac = ' class="active"' if active_stem == "00-GOVERNANCE-ROLES" else ""
    lines.append(f'      <a href="{g}"{ac}><span class="num">۰۰</span> نقش‌ها و قواعد</a>')
    lines.append('    </nav>')
    lines.append('')
    lines.append('    <h2>مستندات اصلی</h2>')
    lines.append('    <nav>')
    nav_items = [
        ("01-PRD", "۰۱", "PRD — نیازمندی محصول"),
        ("02-ARCHITECTURE", "۰۲", "معماری سیستم"),
        ("03-TECH-STACK", "۰۳", "Tech Stack"),
        ("04-DATABASE-SCHEMA", "۰۴", "Database Schema"),
        ("05-API-SPEC", "۰۵", "API Spec"),
        ("06-AI-ARCHITECTURE", "۰۶", "معماری AI"),
        ("07-PROJECT-STRUCTURE", "۰۷", "ساختار پروژه"),
        ("08-ROADMAP", "۰۸", "Roadmap"),
        ("09-AI-AGENT-GUIDE", "۰۹", "راهنمای AI Agent"),
        ("10-GTM-PRICING-MARKETING", "۱۰", "GTM و قیمت‌گذاری"),
        ("11-SECURITY-PRIVACY", "۱۱", "امنیت و حریم خصوصی"),
        ("12-OPERATIONS-SUPPORT", "۱۲", "عملیات و پشتیبانی"),
        ("13-ARCHITECTURE-DECISION-RECORDS", "۱۳", "ADR"),
        ("14-INFRASTRUCTURE", "۱۴", "زیرساخت و سرورها"),
        ("15-DEVELOPMENT-GUIDE-FA", "۱۵", "راهنمای توسعه فارسی"),
        ("16-DEVELOPMENT-STATUS", "۱۶", "وضعیت مراحل توسعه"),
    ]
    for stem, num, label in nav_items:
        href = f"{stem}.html"
        ac = ' class="active"' if stem == active_stem else ""
        lines.append(f'      <a href="{href}"{ac}><span class="num">{num}</span> {label}</a>')
    lines.append('    </nav>')
    return "\n".join(lines)


def extract_mermaid_blocks(md: str) -> tuple[str, list[str]]:
    """Replace ```mermaid ... ``` with placeholders; return (md, blocks)."""
    blocks: list[str] = []

    def repl(m: re.Match[str]) -> str:
        blocks.append(m.group(1).strip("\n"))
        return f"\n\n@@MERMAID{len(blocks) - 1}@@\n\n"

    pattern = re.compile(r"^```mermaid\r?\n([\s\S]*?)^```\s*\r?$", re.MULTILINE)
    new_md = pattern.sub(repl, md)
    return new_md, blocks


def restore_mermaid(html: str, blocks: list[str]) -> str:
    for i, body in enumerate(blocks):
        div = f'<div class="mermaid">\n{body}\n</div>'
        html = html.replace(f"@@MERMAID{i}@@", div)
        html = html.replace(f"<p>@@MERMAID{i}@@</p>", div)
    html = re.sub(r"<p>\s*<div class=\"mermaid\">", '<div class="mermaid">', html)
    html = re.sub(r"</div>\s*</p>", "</div>", html)
    return html


def wrap_tables(html: str) -> str:
    """Wrap each <table>...</table> in table-wrap like hand-authored docs."""
    if "<table>" not in html:
        return html
    parts = html.split("<table>")
    out = [parts[0]]
    for chunk in parts[1:]:
        if "</table>" not in chunk:
            out.append("<table>" + chunk)
            continue
        body, rest = chunk.split("</table>", 1)
        out.append('<div class="table-wrap"><table>' + body + "</table></div>")
        out.append(rest)
    return "".join(out)


def strip_first_h1(md: str) -> tuple[str, str | None]:
    """Remove leading # line; return (rest, h1_text without #)."""
    lines = md.splitlines()
    if lines and lines[0].startswith("# "):
        h1 = lines[0][2:].strip()
        return "\n".join(lines[1:]).lstrip("\n"), h1
    return md, None


def toc_from_md(md: str) -> list[tuple[str, str]]:
    """List of (anchor_id, title) for ## headings — stable numeric ids for anchors."""
    items: list[tuple[str, str]] = []
    n = 0
    for line in md.splitlines():
        if line.startswith("## ") and not line.startswith("### "):
            title = line[3:].strip()
            n += 1
            items.append((f"sec-{n}", title))
    return items


def toc_sidebar_html(items: list[tuple[str, str]]) -> str:
    if not items:
        return ""
    lines = ['    <h2>فهرست این صفحه</h2>', '    <ul class="toc-list">']
    for aid, title in items:
        lines.append(f'      <li><a href="#{html.escape(aid)}">{html.escape(title)}</a></li>')
    lines.append("    </ul>")
    return "\n".join(lines)


def md_to_html_fragment(md: str) -> str:
    import markdown

    return markdown.markdown(
        md,
        extensions=[
            "markdown.extensions.extra",
            "markdown.extensions.tables",
            "markdown.extensions.nl2br",
            "markdown.extensions.sane_lists",
        ],
    )


def link_md_to_html(fragment: str) -> str:
    """Turn sibling .md links in href to .html for human site navigation."""
    fragment = re.sub(
        r'href="(\./)?([0-9]{2}-[^"]+)\.md"',
        lambda m: f'href="{m.group(2)}.html"',
        fragment,
    )
    return fragment


def add_heading_ids(fragment: str, toc_items: list[tuple[str, str]]) -> str:
    """Add id= to each <h2> in document order (matches ## count)."""
    ids = [a for a, _ in toc_items]
    it = iter(ids)

    def repl(_: re.Match[str]) -> str:
        try:
            aid = next(it)
            return f'<h2 id="{html.escape(aid)}">'
        except StopIteration:
            return "<h2>"

    return re.sub(r"<h2>", repl, fragment)


def doc_nav_html(stem: str) -> str:
    seq = [s for s, _, _ in DOCS_ORDER]
    try:
        idx = seq.index(stem)
    except ValueError:
        return ""
    titles = {s: t for s, _, t in DOCS_ORDER}
    if idx == 0:
        prev_link, prev_label = "index.html", "خانه"
    else:
        ps = seq[idx - 1]
        prev_link = f"{ps}.html"
        prev_label = f"{STEM_TO_NUM_FA[ps]} — {titles[ps]}"
    if idx == len(seq) - 1:
        next_link, next_label = "index.html", "خانه"
    else:
        ns = seq[idx + 1]
        next_link = f"{ns}.html"
        next_label = f"{STEM_TO_NUM_FA[ns]} — {titles[ns]}"

    nav = ['    <nav class="doc-nav">']
    nav.append(f'      <a class="prev" href="{prev_link}">')
    nav.append('        <div class="label">← سند قبلی</div>')
    nav.append(f'        <div class="title">{html.escape(prev_label)}</div>')
    nav.append("      </a>")
    nav.append(f'      <a class="next" href="{next_link}">')
    nav.append('        <div class="label">سند بعدی →</div>')
    nav.append(f'        <div class="title">{html.escape(next_label)}</div>')
    nav.append("      </a>")
    nav.append("    </nav>")
    return "\n".join(nav)


def build_one(stem: str, emoji: str, title_suffix: str) -> None:
    md_path = DOCS / f"{stem}.md"
    out_path = DOCS / f"{stem}.html"
    if not md_path.exists():
        print(f"skip missing {md_path}", file=sys.stderr)
        return
    raw = md_path.read_text(encoding="utf-8")
    md_no_mermaid, mermaid_blocks = extract_mermaid_blocks(raw)
    md_body, h1_from_md = strip_first_h1(md_no_mermaid)
    toc_items = toc_from_md(md_body)
    frag = md_to_html_fragment(md_body)
    frag = restore_mermaid(frag, mermaid_blocks)
    frag = link_md_to_html(frag)
    frag = add_heading_ids(frag, toc_items)
    frag = wrap_tables(frag)

    h1_text = (h1_from_md or title_suffix).strip()
    if h1_text.startswith(emoji):
        h1_text = h1_text[len(emoji) :].strip()
    h1_html = f'<h1><span class="emoji">{emoji}</span> {html.escape(h1_text)}</h1>'

    has_mermaid = bool(mermaid_blocks) or "mermaid" in frag
    mermaid_script = (
        '\n<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js" defer></script>'
        if has_mermaid
        else ""
    )

    meta_pills = [
        '<span class="pill">ورژن ۱.۰</span>',
        '<span class="pill">مه ۲۰۲۶</span>',
        '<span class="pill">Status: Active</span>',
        f'<span class="pill">نسخهٔ فارسی — همراه <a href="{stem}.md">{stem}.md</a></span>',
    ]

    num = STEM_TO_NUM_FA[stem]
    aside = (
        "<aside class=\"sidebar\">\n"
        + sidebar_nav_html(stem)
        + "\n"
        + toc_sidebar_html(toc_items)
        + "\n  </aside>"
    )

    meta_html = "".join(f"      {p}\n" for p in meta_pills)

    full = f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{num} · {html.escape(title_suffix)} — Chat-Box</title>
<meta name="description" content="مستندات Chat-Box — {html.escape(title_suffix)}">
<link rel="stylesheet" href="_shared.css">
{mermaid_script}
<script src="_shared.js" defer></script>
</head>
<body>
<div class="app">

{aside}

  <main>
    <div class="topbar">
      <div class="crumbs">
        <button id="menu-toggle" class="iconbtn menu-toggle" aria-label="menu">☰</button>
        <a href="index.html">Docs</a>
        <span class="sep">/</span>
        <span>{num} — {html.escape(title_suffix)}</span>
      </div>
      <div class="topbar-actions">
        <button class="iconbtn" onclick="window.__cbToggleTheme()" aria-label="theme">◐</button>
      </div>
    </div>

{h1_html}

    <div class="doc-meta">
{meta_html}
    </div>

{frag}

{doc_nav_html(stem)}
  </main>
</div>
</body>
</html>
"""
    out_path.write_text(full, encoding="utf-8")
    print(f"wrote {out_path.relative_to(DOCS.parent)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("stems", nargs="*", help="Markdown stems without .md (default: all generated)")
    args = ap.parse_args()
    targets = (
        args.stems
        if args.stems
        else [s for s, _, _ in DOCS_ORDER if s not in HAND_AUTHORED]
    )
    lookup = {s: (e, t) for s, e, t in DOCS_ORDER}
    for stem in targets:
        if stem not in lookup:
            print(f"unknown stem {stem}", file=sys.stderr)
            continue
        emoji, title_s = lookup[stem]
        build_one(stem, emoji, title_s)


if __name__ == "__main__":
    main()
