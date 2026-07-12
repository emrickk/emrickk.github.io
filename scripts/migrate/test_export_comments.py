import json
import os
import glob

from export_comments import export_all, sanitize_body

HERE = os.path.dirname(os.path.abspath(__file__))
COMMENTS_DIR = os.path.join(HERE, '..', '..', 'src', 'data', 'comments')

def test_export_scope_and_pii():
    n = export_all()
    assert 0 < n <= 222                        # only comments on migrated published posts
    for f in glob.glob(os.path.join(COMMENTS_DIR, '*.json')):
        for c in json.load(open(f, encoding='utf-8')):
            assert set(c) == {'author', 'date', 'body'}   # no email/IP/url keys, ever

def test_sanitize_body_defuses_dangerous_html():
    # Bodies are rendered with set:html downstream (Task 8), so export must
    # defuse script vectors while leaving benign markup for the renderer.
    html = ('<p>hello</p>'
            '<script>alert(1)</script>'
            '<a href="javascript:alert(2)" onclick="steal()">click</a>'
            '<a href="https://example.com/x">ok</a>')
    out = sanitize_body(html)
    assert '<script' not in out and 'alert(1)' not in out
    assert 'onclick' not in out and 'steal()' not in out
    assert 'javascript:' not in out and 'href="#"' in out
    assert '<p>hello</p>' in out                       # benign tags survive
    assert 'https://example.com/x' in out              # benign links survive

def test_sanitize_body_clean_html_passes_through_byte_identical():
    # Clean bodies must come back unchanged (not even re-serialized), so
    # sanitizing the archive never churns files that had nothing dangerous.
    html = '<p>哈哈哈</p> <img src="http://img.example.com/a.gif" /> line<br />end'
    assert sanitize_body(html) == html
