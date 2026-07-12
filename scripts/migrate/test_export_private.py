import glob
import os

from export_private import PRIVATE_DIR, PUBLIC_UPLOADS, REPO, export_all

# Directories whose contents are runtime/tooling artifacts, not something
# export_private.py could plausibly write to, and which change on their own
# during a normal test run (bytecode caches, pytest's own cache, etc).
_SKIP_DIRS = {'__pycache__', '.venv', '.git', '.pytest_cache', 'node_modules',
              'dist', '.astro'}


def _snapshot(root):
    """{relpath: (mtime_ns, size)} for every file under `root`, skipping
    tooling directories. Used to prove export_private.py leaves the repo
    working tree byte-for-byte and timestamp-for-timestamp untouched — the
    strong invariant this test file exists to guard.
    """
    snap = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for fn in filenames:
            path = os.path.join(dirpath, fn)
            st = os.stat(path)
            snap[os.path.relpath(path, root)] = (st.st_mtime_ns, st.st_size)
    return snap


def test_export_does_not_touch_repo_working_tree():
    before = _snapshot(REPO)
    export_all()
    after = _snapshot(REPO)
    assert before == after


def test_file_count_and_status_lines():
    export_all()
    files = sorted(glob.glob(os.path.join(PRIVATE_DIR, '*.md')))
    assert len(files) == 27

    private_count = archived_count = 0
    for path in files:
        if os.path.basename(path) == '_about-source.md':
            continue
        with open(path, encoding='utf-8') as f:
            content = f.read()
        assert content.startswith('---\n')  # same frontmatter shape as published posts
        if 'status: private\n' in content:
            private_count += 1
        elif 'status: archived-page\n' in content:
            archived_count += 1
        else:
            raise AssertionError(f'{path} has neither status line')
    assert private_count == 22
    assert archived_count == 4
    assert os.path.exists(os.path.join(PRIVATE_DIR, '_about-source.md'))


def test_about_source_merges_both_pages_no_frontmatter():
    export_all()
    with open(os.path.join(PRIVATE_DIR, '_about-source.md'), encoding='utf-8') as f:
        content = f.read()
    assert content.index('## About') < content.index('## About Me')
    assert not content.startswith('---')  # plain concatenation, not a frontmatter file


def test_missing_image_refs_are_genuinely_absent_from_public_uploads():
    # Any ref flagged as "not in public/uploads" must actually be absent there —
    # export_private.py must never claim a false positive that could mask a
    # ref this script silently failed to check.
    report = export_all()
    for refs in report['missing_images'].values():
        for ref in refs:
            assert not os.path.isfile(os.path.join(PUBLIC_UPLOADS, ref))


def test_rerun_is_a_no_op_when_nothing_changed():
    # Write-only-if-changed: a second run back-to-back must not touch mtimes.
    export_all()
    before = _snapshot(PRIVATE_DIR)
    export_all()
    after = _snapshot(PRIVATE_DIR)
    assert before == after
