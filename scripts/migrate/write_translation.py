"""Apply translation results to posts: write sibling body files and upsert
both-language titles into primaries. Deterministic; agents produce the
translations, this module writes them uniformly.

Usage: python write_translation.py results.json
  results.json: list of {slug, lang, titleZh, titleEn, body[, flags]}
  where `lang` is the primary's ORIGINAL language and `body` is the
  translated body (in the other language).
"""
import json
import re
import sys
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parents[2] / "src" / "content" / "posts"
DATE_RE = re.compile(r"^\d{4}[-/.]?\d{2}[-/.]?\d{2}$|^\d{8}$|^\d{4}-\d{2}-\d{2}")


def is_date_title(title: str) -> bool:
    return bool(DATE_RE.match((title or "").strip()))


def sibling_name(slug: str, lang: str) -> str:
    return f"{slug}.{lang}.md"


def _yaml_q(s: str) -> str:
    """Single-quoted YAML scalar with quotes doubled."""
    return "'" + (s or "").replace("'", "''") + "'"


def _split(src: str):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", src, re.DOTALL)
    if not m:
        raise ValueError("no frontmatter")
    return m.group(1), m.group(2)


def _read_field(lines, key):
    for line in lines:
        if line.startswith(key + ":"):
            return line.split(":", 1)[1].strip().strip("'\"")
    return None


def _set_field(lines, key, value):
    vline = f"{key}: {_yaml_q(value)}"
    for i, line in enumerate(lines):
        if line.startswith(key + ":"):
            lines[i] = vline
            return lines
    lines.append(vline)
    return lines


def upsert_titles(src: str, title_zh: str, title_en: str) -> str:
    fm, body = _split(src)
    lines = fm.split("\n")
    lang = _read_field(lines, "lang") or "zh"
    cur_title = _read_field(lines, "title")
    if cur_title is not None and is_date_title(cur_title):
        new_title = title_zh if lang == "zh" else title_en
        _set_field(lines, "title", new_title)
    _set_field(lines, "titleZh", title_zh)
    _set_field(lines, "titleEn", title_en)
    return "---\n" + "\n".join(lines) + "\n---\n" + body


def write_sibling(slug: str, lang: str, title: str, body: str) -> Path:
    """lang = the sibling's (translation) language."""
    path = POSTS_DIR / sibling_name(slug, lang)
    fm = (
        "---\n"
        f"translationKey: {_yaml_q(slug)}\n"
        f"lang: {_yaml_q(lang)}\n"
        f"title: {_yaml_q(title)}\n"
        "---\n\n"
    )
    path.write_text(fm + body.rstrip("\n") + "\n", encoding="utf-8")
    return path


def apply_result(r: dict) -> None:
    slug = r["slug"]
    lang = r["lang"]  # original language of the primary
    other = "en" if lang == "zh" else "zh"
    title_zh = r["titleZh"]
    title_en = r["titleEn"]
    body = r["body"]
    sib_title = title_en if other == "en" else title_zh
    write_sibling(slug, other, sib_title, body)
    primary = POSTS_DIR / f"{slug}.md"
    src = primary.read_text(encoding="utf-8")
    primary.write_text(upsert_titles(src, title_zh, title_en), encoding="utf-8")


def main() -> None:
    results = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    ok = 0
    for r in results:
        try:
            apply_result(r)
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {r.get('slug')}: {e}")
    print(f"applied {ok}/{len(results)}")


if __name__ == "__main__":
    main()
