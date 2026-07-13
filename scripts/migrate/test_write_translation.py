import textwrap

import write_translation as wt
from write_translation import is_date_title, sibling_name, upsert_titles


def test_is_date_title():
    assert is_date_title("2014-08-17")
    assert is_date_title("20080404")
    assert is_date_title("2013-02-26")
    assert is_date_title("2023-03-01")
    assert not is_date_title("水")
    assert not is_date_title("Water")
    assert not is_date_title("Leaving Comments?")
    assert not is_date_title("小记一篇")


def test_sibling_name():
    assert sibling_name("be-water", "en") == "be-water.en.md"
    assert sibling_name("448", "zh") == "448.zh.md"


def test_upsert_titles_replaces_date_title_with_original_language():
    src = textwrap.dedent("""\
        ---
        title: '2014-08-17'
        description: ''
        pubDate: '2014-08-17'
        category: 'Repost'
        lang: 'zh'
        translationKey: '448'
        ---

        请别看穿我的心事
        """)
    out = upsert_titles(src, title_zh='牵着我的手', title_en='Hold My Hand')
    assert "titleZh: '牵着我的手'" in out
    assert "titleEn: 'Hold My Hand'" in out
    # date title replaced by the original-language (zh) title
    assert "title: '牵着我的手'" in out
    assert "title: '2014-08-17'" not in out
    # body untouched, other fields kept
    assert "请别看穿我的心事" in out
    assert "category: 'Repost'" in out


def test_upsert_titles_keeps_real_title():
    src = textwrap.dedent("""\
        ---
        title: '水'
        description: ''
        pubDate: '2006-10-03'
        category: 'Journal'
        lang: 'zh'
        translationKey: 'be-water'
        ---

        折戟沉沙铁未消
        """)
    out = upsert_titles(src, title_zh='水', title_en='Water')
    assert "title: '水'" in out
    assert "titleZh: '水'" in out
    assert "titleEn: 'Water'" in out


def test_upsert_titles_english_origin_date_uses_english():
    src = textwrap.dedent("""\
        ---
        title: '2013-04-07'
        description: ''
        pubDate: '2013-04-07'
        lang: 'en'
        translationKey: 'x'
        ---

        Some English body.
        """)
    out = upsert_titles(src, title_zh='标题', title_en='A Real Title')
    assert "title: 'A Real Title'" in out
    assert "titleEn: 'A Real Title'" in out
    assert "titleZh: '标题'" in out


def test_upsert_titles_escapes_apostrophes():
    src = textwrap.dedent("""\
        ---
        title: 'x'
        description: ''
        pubDate: '2013-04-07'
        lang: 'en'
        translationKey: 'x'
        ---

        body
        """)
    out = upsert_titles(src, title_zh='中', title_en="It's Mine")
    assert "titleEn: 'It''s Mine'" in out


def test_write_sibling_and_apply(tmp_path, monkeypatch):
    monkeypatch.setattr(wt, "POSTS_DIR", tmp_path)
    primary = tmp_path / "foo.md"
    primary.write_text(textwrap.dedent("""\
        ---
        title: '2015-08-11'
        description: ''
        pubDate: '2015-08-11'
        category: 'Journal'
        lang: 'zh'
        translationKey: 'foo'
        ---

        中文正文
        """), encoding="utf-8")
    wt.apply_result({
        "slug": "foo",
        "lang": "zh",
        "titleZh": "标题",
        "titleEn": "A Title",
        "body": "English body line 1\n\nEnglish body line 2",
    })
    sib = tmp_path / "foo.en.md"
    assert sib.exists()
    sib_text = sib.read_text(encoding="utf-8")
    assert "translationKey: 'foo'" in sib_text
    assert "lang: 'en'" in sib_text
    assert "title: 'A Title'" in sib_text
    assert "English body line 1" in sib_text
    # primary updated
    prim_text = primary.read_text(encoding="utf-8")
    assert "titleZh: '标题'" in prim_text
    assert "titleEn: 'A Title'" in prim_text
    assert "title: '标题'" in prim_text
