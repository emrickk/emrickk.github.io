import backup_paths
from convert_posts import (_strip_dead_images, convert_body, is_slug_collision,
                           make_title, make_slug, published_slug_map, rewrite_images)
from wp_parser import load_dump

def test_untitled_same_day_suffixes():
    rows = [('101', '2013-04-18 10:00:00', ''), ('102', '2013-04-18 11:00:00', ''),
            ('103', '2013-04-18 12:00:00', '')]
    titles = make_title(rows)   # {id: title} for untitled posts, ID order
    assert titles == {'101': '2013-04-18', '102': '2013-04-18·2', '103': '2013-04-18·3'}

def test_slug_ascii_or_dated():
    assert make_slug('remarkable-2', '2021-03-14', '1604', set()) == 'remarkable-2'
    assert make_slug('%e6%97%a0%e9%a2%98', '2013-04-18', '853', set()) == '2013-04-18-p853'
    assert make_slug('', '2005-09-18', '96', set()) == '2005-09-18-p96'

def test_slug_collision_appends_post_id():
    taken = {'remarkable-2'}
    assert make_slug('remarkable-2', '2021-03-14', '1604', taken) == 'remarkable-2-p1604'
    # date fallback slugs can collide too (two untitled posts, same day, same ID
    # prefix impossible — but a hand-crafted taken set exercises the append path)
    assert make_slug('', '2013-04-18', '853', {'2013-04-18-p853'}) == '2013-04-18-p853-p853'

def test_collision_recording_is_pre_resolution():
    # The report must record a collision when the BASE slug (ignoring taken) is
    # already assigned — checking the resolved slug would never fire.
    assert is_slug_collision('remarkable-2', '2021-03-14', '1604', {'remarkable-2'})
    assert not is_slug_collision('remarkable-2', '2021-03-14', '1604', set())
    assert not is_slug_collision('fresh-slug', '2021-03-14', '1604', {'remarkable-2'})

def test_strip_dead_images():
    html = ('<img src="http://res.smzdm.com/images/emotions/25.png">'
            '<img src="http://emrick.us/wp-content/uploads/2020/02/kb.jpg">')
    out = _strip_dead_images(html)
    assert 'smzdm' not in out
    assert 'emrick.us/wp-content/uploads/2020/02/kb.jpg' in out

def test_plain_text_single_newlines_become_hard_breaks(tmp_path):
    # wpautop rendered single \n inside a paragraph as <br>; CommonMark soft breaks
    # join CJK lines with nothing between them, so verse lines need hard breaks.
    html = '天欲雨，淅沥声仿佛是从山的背面来的\n另一面是含羞的花\n\n我捧在手里的全部时光'
    body = convert_body(html, uploads_root=str(tmp_path))
    assert body == '天欲雨，淅沥声仿佛是从山的背面来的\\\n另一面是含羞的花\n\n我捧在手里的全部时光'

def test_html_chunks_not_double_processed(tmp_path):
    # Chunks containing HTML tags go through markdownify untouched: real <br> tags
    # already yield hard breaks (two trailing spaces) and must not gain backslashes.
    html = '<span>line1</span><br /><span>line2</span>'
    body = convert_body(html, uploads_root=str(tmp_path))
    assert body == 'line1  \nline2'
    assert '\\' not in body

def test_fence_starter_lines_escaped_in_plain_text(tmp_path):
    # Post 962 uses ~~~~~ as a visual divider; CommonMark reads a line starting
    # with 3+ tildes (or backticks) as a code-fence opener, swallowing the rest
    # of the post into a code block. Plain-text chunks must escape such lines.
    import re
    html = '只愿面朝大海，春暖花开。\n\n~~~~~\n人生原来是这样的'
    body = convert_body(html, uploads_root=str(tmp_path))
    assert '\\~~~~~' in body                                # renders literally
    assert not re.search(r'^\s*[~`]{3,}', body, re.M)       # no fence can open
    assert '人生原来是这样的' in body
    # HTML-bearing chunks are untouched by this escape (spec scope: plain path)
    assert convert_body('<span>~~~~~</span>', uploads_root=str(tmp_path)) == '~~~~~'

def test_image_rewrite_strips_size_variant(tmp_path):
    (tmp_path / '2020' / '11').mkdir(parents=True)
    (tmp_path / '2020' / '11' / 'kb.jpg').write_bytes(b'x')
    html = '<img src="https://emrick.us/wp-content/uploads/2020/11/kb-300x200.jpg">'
    out, used = rewrite_images(html, uploads_root=str(tmp_path))
    assert '/uploads/2020/11/kb.jpg' in out and used == {'2020/11/kb.jpg'}

def test_published_slug_map_matches_known_posts():
    d = load_dump(backup_paths.dump_path())
    slug_map = published_slug_map(d)
    assert len(slug_map) == 318
    assert slug_map['1604'] == 'remarkable-2-review'   # the reMarkable review post
    assert slug_map['437'] == 'amazon-japan-shopping'

def test_write_report_preserves_comments_exported_line(tmp_path, monkeypatch):
    # report.txt is shared with export_comments.py: a standalone convert_all()
    # re-run must not silently drop the comments_exported line it didn't write.
    import convert_posts
    report = tmp_path / 'report.txt'
    report.write_text(
        'posts_written: 1\nimages_used: 0\nflagged_fffd: 0\nslug_collisions: 0\n'
        'comments_exported: 183\n\nFlagged posts (body contains U+FFFD):\n  (none)\n',
        encoding='utf-8')
    monkeypatch.setattr(convert_posts, 'REPORT_PATH', str(report))
    convert_posts._write_report({'posts_written': 1, 'images_used': set(),
                                 'flagged_fffd': [], 'slug_collisions': []})
    assert 'comments_exported: 183' in report.read_text(encoding='utf-8')
