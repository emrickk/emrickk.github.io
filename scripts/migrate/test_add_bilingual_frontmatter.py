import textwrap

from add_bilingual_frontmatter import detect_lang, add_fields


def test_detect_lang_chinese():
    assert detect_lang("折戟沉沙铁未消") == "zh"


def test_detect_lang_english():
    assert detect_lang("The quick brown fox.") == "en"


def test_add_fields_injects_lang_and_key_idempotently():
    src = textwrap.dedent("""\
        ---
        title: '水'
        description: ''
        pubDate: '2006-10-03'
        category: 'Journal'
        ---

        折戟沉沙铁未消，自将磨洗认前朝。
        """)
    out = add_fields(src, slug="be-water")
    assert "lang: 'zh'" in out
    assert "translationKey: 'be-water'" in out
    # idempotent: running twice does not duplicate
    assert add_fields(out, slug="be-water") == out
    # body untouched
    assert "折戟沉沙铁未消，自将磨洗认前朝。" in out
    # existing keys preserved
    assert "title: '水'" in out


def test_english_post_detected():
    src = textwrap.dedent("""\
        ---
        title: 'Hello'
        description: ''
        pubDate: '2014-01-01'
        ---

        This is an English post body with no CJK.
        """)
    out = add_fields(src, slug="hello")
    assert "lang: 'en'" in out
    assert "translationKey: 'hello'" in out
