import backup_paths
from wp_parser import load_dump

def _d():
    return load_dump(backup_paths.dump_path())

def test_counts_match_audit():
    # Field index meanings (p[20], p[7], c[10], ...): see load_dump() docstring in wp_parser.py
    d = _d()
    posts = [p for p in d['wp_posts'] if p[20] == 'post']
    assert sum(1 for p in posts if p[7] == 'publish') == 318
    assert sum(1 for p in posts if p[7] == 'private') == 22
    assert sum(1 for p in d['wp_posts'] if p[20] == 'page' and p[7] == 'publish') == 6
    assert sum(1 for c in d['wp_comments'] if c[10] == '1') == 222

def test_escapes_unescaped():
    d = _d()
    # No raw MySQL escape sequences may survive parsing
    assert not any("\\'" in (p[4] or '') for p in d['wp_posts'])
