"""Add `lang` and `translationKey` frontmatter to primary post files. Idempotent.

`lang` is detected from the body (CJK present -> 'zh', else 'en').
`translationKey` is the file's slug (filename without extension).

Sibling translation files (`*.en.md` / `*.zh.md`) are skipped.
"""
import re
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parents[2] / "src" / "content" / "posts"
CJK = re.compile(r"[一-鿿]")
SIBLING = re.compile(r"\.(en|zh)\.md$")


def detect_lang(text: str) -> str:
    return "zh" if CJK.search(text or "") else "en"


def _split(src: str):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", src, re.DOTALL)
    if not m:
        raise ValueError("no frontmatter")
    return m.group(1), m.group(2)


def add_fields(src: str, slug: str) -> str:
    fm, body = _split(src)
    lines = fm.split("\n")
    has_lang = any(l.startswith("lang:") for l in lines)
    has_key = any(l.startswith("translationKey:") for l in lines)
    lang = detect_lang(body)
    additions = []
    if not has_lang:
        additions.append(f"lang: '{lang}'")
    if not has_key:
        additions.append(f"translationKey: '{slug}'")
    if additions:
        lines = lines + additions
    return "---\n" + "\n".join(lines) + "\n---\n" + body


def main() -> None:
    changed = 0
    for f in sorted(POSTS_DIR.glob("*.md")):
        if SIBLING.search(f.name):
            continue
        slug = f.name[:-3]
        src = f.read_text(encoding="utf-8")
        out = add_fields(src, slug=slug)
        if out != src:
            f.write_text(out, encoding="utf-8")
            changed += 1
    print(f"updated {changed} files")


if __name__ == "__main__":
    main()
