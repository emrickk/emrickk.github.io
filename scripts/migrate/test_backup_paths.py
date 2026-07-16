import os

import pytest

import backup_paths


def _make_backup(root):
    """Create a minimal backup skeleton (just the file backup_root() checks for)
    under `root` and return `root` as a str."""
    db_dir = root / 'db'
    db_dir.mkdir(parents=True, exist_ok=True)
    (db_dir / 'emrickus_wp.sql').write_text('-- fake dump\n', encoding='utf-8')
    return str(root)


def test_env_override_wins_even_when_repo_candidates_dont_match(tmp_path, monkeypatch):
    # Point REPO somewhere with no backup anywhere nearby, so neither the
    # <repo>/../../Backup nor the <repo>/.. candidate could possibly match --
    # proving a hit only comes from the env override, not by accident.
    fake_repo = tmp_path / 'nowhere' / 'deeply' / 'nested' / 'repo'
    fake_repo.mkdir(parents=True)
    monkeypatch.setattr(backup_paths, 'REPO', str(fake_repo))

    env_root = tmp_path / 'env-backup'
    _make_backup(env_root)
    monkeypatch.setenv('BLOG_BACKUP_ROOT', str(env_root))

    assert backup_paths.backup_root() == os.path.abspath(str(env_root))
    assert backup_paths.dump_path() == os.path.join(str(env_root), 'db', 'emrickus_wp.sql')


def test_no_candidate_matches_raises_with_all_tried_paths_listed(tmp_path, monkeypatch):
    monkeypatch.delenv('BLOG_BACKUP_ROOT', raising=False)
    fake_repo = tmp_path / 'nowhere' / 'repo'
    fake_repo.mkdir(parents=True)
    monkeypatch.setattr(backup_paths, 'REPO', str(fake_repo))

    with pytest.raises(RuntimeError) as exc_info:
        backup_paths.backup_root()

    message = str(exc_info.value)
    assert '<repo>/../../Backup' in message
    assert '<repo>/..' in message
    assert 'BLOG_BACKUP_ROOT' in message


def test_repo_parent_backup_candidate_is_found(tmp_path, monkeypatch):
    # New layout: backup lives at <repo>/../../Backup.
    monkeypatch.delenv('BLOG_BACKUP_ROOT', raising=False)
    repo = tmp_path / 'Personal Website' / 'Personal Blog' / 'blog'
    repo.mkdir(parents=True)
    _make_backup(tmp_path / 'Personal Website' / 'Backup')
    monkeypatch.setattr(backup_paths, 'REPO', str(repo))

    root = backup_paths.backup_root()
    assert root == os.path.abspath(str(tmp_path / 'Personal Website' / 'Backup'))
    assert backup_paths.uploads_root() == os.path.join(root, 'site', 'wp-content', 'uploads')
    assert backup_paths.private_posts_dir() == os.path.join(root, 'private-posts')


def _make_twitter_archive(root):
    data_dir = root / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / 'tweets.js').write_text('window.YTD.tweets.part0 = []\n', encoding='utf-8')
    return str(root)


def test_twitter_archive_env_override_wins(tmp_path, monkeypatch):
    fake_repo = tmp_path / 'nowhere' / 'repo'
    fake_repo.mkdir(parents=True)
    monkeypatch.setattr(backup_paths, 'REPO', str(fake_repo))
    env_root = tmp_path / 'env-archive'
    _make_twitter_archive(env_root)
    monkeypatch.setenv('TWITTER_ARCHIVE_ROOT', str(env_root))
    assert backup_paths.twitter_archive_root() == os.path.abspath(str(env_root))


def test_twitter_archive_backup_sibling_found(tmp_path, monkeypatch):
    monkeypatch.delenv('TWITTER_ARCHIVE_ROOT', raising=False)
    repo = tmp_path / 'Personal Website' / 'Personal Blog' / 'blog'
    repo.mkdir(parents=True)
    _make_twitter_archive(tmp_path / 'Personal Website' / 'Backup' / 'twitter-archive')
    monkeypatch.setattr(backup_paths, 'REPO', str(repo))
    root = backup_paths.twitter_archive_root()
    assert root.endswith(os.path.join('Backup', 'twitter-archive'))


def test_twitter_archive_missing_raises_friendly_error(tmp_path, monkeypatch):
    monkeypatch.delenv('TWITTER_ARCHIVE_ROOT', raising=False)
    fake_repo = tmp_path / 'nowhere' / 'repo'
    fake_repo.mkdir(parents=True)
    monkeypatch.setattr(backup_paths, 'REPO', str(fake_repo))
    with pytest.raises(RuntimeError) as exc_info:
        backup_paths.twitter_archive_root()
    message = str(exc_info.value)
    assert 'twitter-archive' in message
    assert 'TWITTER_ARCHIVE_ROOT' in message
    assert 'data/tweets.js' in message
