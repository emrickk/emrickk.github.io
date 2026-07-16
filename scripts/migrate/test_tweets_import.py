import json
import os

import tweets_import
from tweets_import import (
    build_notes, classify, emit, escape_md, load_archive, parse_date,
    render_note, transform_text, write_if_changed,
)

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'twitter-archive')


def _load():
    return load_archive(FIXTURE)


def _built():
    tweets, account = _load()
    media_root = os.path.join(FIXTURE, 'data', 'tweets_media')
    return build_notes(tweets, account, media_root)


def test_load_archive_parses_ytd_wrappers():
    tweets, account = _load()
    assert len(tweets) == 13
    assert account['username'] == 'fixtureuser'
    assert account['accountId'] == '424242'


def test_classify_filters_and_chains():
    tweets, account = _load()
    threads, dropped, orphan_roots = classify(tweets, account['accountId'])
    root_ids = sorted(chain[0]['id_str'] for chain in threads)
    assert root_ids == ['9001', '9004', '9007', '9008', '9009', '9012', '9013']
    assert [t['id_str'] for t in dropped['retweets']] == ['9002']
    assert sorted(t['id_str'] for t in dropped['replies']) == ['9003', '9010']
    assert [t['id_str'] for t in dropped['chain']] == ['9011']
    assert orphan_roots == []


def test_thread_stitching_is_chronological():
    tweets, account = _load()
    threads, _dropped, _orphans = classify(tweets, account['accountId'])
    thread = next(chain for chain in threads if chain[0]['id_str'] == '9004')
    assert [t['id_str'] for t in thread] == ['9004', '9005', '9006']


def test_transform_entity_laden_text():
    tweets, _account = _load()
    t = next(x for x in tweets if x['id_str'] == '9008')
    out = transform_text(t)
    assert out == (
        'Fun & games \\<3 with \\*stars\\*, \\_underscores\\_, '
        '\\[brackets\\], \\`ticks\\`, #tag and '
        '[@mention_1](https://x.com/mention_1) '
        'https://example.com/a_(b)?q=1&x=2'
    )


def test_transform_quote_tweet_keeps_plain_link():
    tweets, _account = _load()
    t = next(x for x in tweets if x['id_str'] == '9007')
    assert transform_text(t) == 'Quoting this gem https://x.com/someone/status/777'


def test_transform_emoticon_without_mention_entity_stays_verbatim():
    # 9013 has an @_@ emoticon and EMPTY entities.user_mentions: it must
    # never become a mention link. The underscore is markdown-escaped like
    # any other literal text, so the rendered note shows the emoticon verbatim.
    tweets, _account = _load()
    t = next(x for x in tweets if x['id_str'] == '9013')
    out = transform_text(t)
    assert out == '寂寞的电路课@\\_@'
    assert '](https://x.com/' not in out


def test_escape_md_line_starts():
    assert escape_md('- item') == '\\- item'
    assert escape_md('+ item') == '\\+ item'
    assert escape_md('# not a heading') == '\\# not a heading'
    assert escape_md('1. item') == '1\\. item'
    assert escape_md('mid - dash stays') == 'mid - dash stays'


def test_build_notes_counts_and_bodies():
    notes, counts, manifest_rows, details = _built()
    assert counts == {
        'archive_total': 13,
        'kept_tweets': 8,
        'notes_emitted': 6,
        'retweets_dropped': 1,
        'replies_dropped': 3,
        'chain_dropped': 1,
        'empties_flagged': 1,
        'orphan_roots': 0,
        'media_photos': 2,
        'media_missing': 1,
        'media_skipped_nonphoto': 0,
    }
    assert counts['archive_total'] == (counts['kept_tweets'] + counts['retweets_dropped']
                                       + counts['replies_dropped'] + counts['empties_flagged'])
    assert details['empties_flagged'] == ['9012']
    assert details['media_missing'] == ['9012-GoneC.jpg']
    thread = next(n for n in notes if n['tweetId'] == '9004')
    assert thread['tweetCount'] == 3
    assert thread['source'] == 'https://x.com/fixtureuser/status/9004'
    assert thread['body'] == (
        'Thread start: counting down.\n\n'
        'Thread middle.\n\n'
        'Thread end, with a photo.\n\n'
        '![](https://cdn.theneverless.com/notes/9006-1.webp)'
    )
    photo_only = next(n for n in notes if n['tweetId'] == '9009')
    assert photo_only['body'] == '![](https://cdn.theneverless.com/notes/9009-1.webp)'
    emoticon = next(n for n in notes if n['tweetId'] == '9013')
    assert emoticon['body'] == '寂寞的电路课@\\_@'
    assert manifest_rows == [
        {'archive': '9006-FixA.jpg', 'staged': '9006-1.jpg',
         'key': 'notes/9006-1.webp', 'url': 'https://cdn.theneverless.com/notes/9006-1.webp'},
        {'archive': '9009-FixB.png', 'staged': '9009-1.png',
         'key': 'notes/9009-1.webp', 'url': 'https://cdn.theneverless.com/notes/9009-1.webp'},
    ]


def test_render_note_frontmatter():
    notes, _c, _m, _d = _built()
    note = next(n for n in notes if n['tweetId'] == '9001')
    assert render_note(note) == (
        "---\n"
        "date: '2010-08-05T09:00:00.000Z'\n"
        "tweetId: '9001'\n"
        "source: 'https://x.com/fixtureuser/status/9001'\n"
        "tweetCount: 1\n"
        "---\n"
        "\n"
        "Hello world, the first note.\n"
    )


def test_emit_names_files_from_utc_and_suffixes_collisions(tmp_path):
    notes, _c, _m, _d = _built()
    out = str(tmp_path / 'notes')
    written = emit(notes, out)
    assert written == 6
    names = sorted(os.listdir(out))
    assert '20100805-090000.md' in names
    assert '20120101-100000.md' in names
    assert '20110826-032041.md' in names
    clone = dict(notes[0], tweetId='9999')
    emit([notes[0], clone], out)
    assert '20100805-090000-2.md' in os.listdir(out)


def test_emit_is_idempotent_and_write_only_if_changed(tmp_path):
    notes, _c, _m, _d = _built()
    out = str(tmp_path / 'notes')
    assert emit(notes, out) == 6
    assert emit(notes, out) == 0
    path = os.path.join(out, '20100805-090000.md')
    with open(path, encoding='utf-8') as f:
        before = f.read()
    assert write_if_changed(path, before) is False
    assert write_if_changed(path, before + 'x') is True


def test_emit_rekeys_existing_files_by_tweet_id(tmp_path):
    notes, _c, _m, _d = _built()
    out = str(tmp_path / 'notes')
    emit(notes, out)
    edited = [dict(n, body=n['body'] + '\n\nappended') if n['tweetId'] == '9001' else n for n in notes]
    assert emit(edited, out) == 1
    with open(os.path.join(out, '20100805-090000.md'), encoding='utf-8') as f:
        assert 'appended' in f.read()
