"""Locate the read-only WordPress backup (SQL dump, uploads, private-posts)
regardless of where the repo lives relative to it.

The repo has moved once already (website/blog -> Personal Website/Personal
Blog/blog) while the backup moved to a different sibling layout, so every
script that reads the backup goes through this single locator instead of
hardcoding a relative path.

Resolution order (first candidate whose db/emrickus_wp.sql actually exists wins):
  1. env BLOG_BACKUP_ROOT, if set                         -- explicit override
  2. <repo>/../../Backup                                   -- current layout:
     repo at .../Personal Website/Personal Blog/blog, backup at
     .../Personal Website/Backup (a sibling of "Personal Blog")
  3. <repo>/..                                              -- old layout: db/
     and site/ sat directly next to the repo (website/blog + website/db)

All paths are computed relative to this file's own directory, so the
caller's cwd never matters.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))  # scripts/migrate -> scripts -> repo root


def _candidates():
    out = []
    env = os.environ.get('BLOG_BACKUP_ROOT')
    if env:
        out.append(('env BLOG_BACKUP_ROOT', os.path.abspath(env)))
    out.append(('<repo>/../../Backup', os.path.abspath(os.path.join(REPO, '..', '..', 'Backup'))))
    out.append(('<repo>/..', os.path.abspath(os.path.join(REPO, '..'))))
    return out


def backup_root():
    """Return the first candidate root that actually contains db/emrickus_wp.sql.

    Raises RuntimeError listing every path tried (with its label) if none match.
    """
    tried = []
    for label, path in _candidates():
        tried.append(f'{label} -> {path}')
        if os.path.isfile(os.path.join(path, 'db', 'emrickus_wp.sql')):
            return path
    raise RuntimeError(
        'Could not locate the WordPress backup (looked for db/emrickus_wp.sql under):\n  '
        + '\n  '.join(tried)
        + '\nSet BLOG_BACKUP_ROOT to override.'
    )


def dump_path():
    return os.path.join(backup_root(), 'db', 'emrickus_wp.sql')


def uploads_root():
    return os.path.join(backup_root(), 'site', 'wp-content', 'uploads')


def private_posts_dir():
    return os.path.join(backup_root(), 'private-posts')


def twitter_archive_root():
    """Return the extracted X/Twitter archive root (must contain data/tweets.js).

    Resolution order (first hit wins):
      1. env TWITTER_ARCHIVE_ROOT                       -- explicit override
      2. <repo>/../../Backup/twitter-archive            -- current layout:
         repo under Personal Website/Personal Blog/, archive extracted at
         Personal Website/Backup/twitter-archive

    Raises RuntimeError listing every path tried if none match.
    """
    candidates = []
    env = os.environ.get('TWITTER_ARCHIVE_ROOT')
    if env:
        candidates.append(('env TWITTER_ARCHIVE_ROOT', os.path.abspath(env)))
    candidates.append(('<repo>/../../Backup/twitter-archive',
                       os.path.abspath(os.path.join(REPO, '..', '..', 'Backup', 'twitter-archive'))))
    tried = []
    for label, path in candidates:
        tried.append(f'{label} -> {path}')
        if os.path.isfile(os.path.join(path, 'data', 'tweets.js')):
            return path
    raise RuntimeError(
        'Could not locate the extracted X/Twitter archive (looked for data/tweets.js under):\n  '
        + '\n  '.join(tried)
        + '\nExtract the X archive ZIP to Personal Website/Backup/twitter-archive/ '
        'or set TWITTER_ARCHIVE_ROOT to override.'
    )
