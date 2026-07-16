import os

import verify_tweets


def test_reconcile_accepts_matching_counts():
    counts = {'archive_total': 12, 'kept_tweets': 7, 'retweets_dropped': 1,
              'replies_dropped': 3, 'empties_flagged': 1}
    assert verify_tweets.reconcile(counts) == []


def test_reconcile_reports_mismatch():
    counts = {'archive_total': 13, 'kept_tweets': 7, 'retweets_dropped': 1,
              'replies_dropped': 3, 'empties_flagged': 1}
    problems = verify_tweets.reconcile(counts)
    assert len(problems) == 1
    assert '13' in problems[0]


def test_parse_report_reads_count_lines_only(tmp_path):
    report = tmp_path / 'tweets_report.txt'
    report.write_text('archive_total: 12\nkept_tweets: 7\n\n# empties_flagged\n  9012\n',
                      encoding='utf-8')
    parsed = verify_tweets.parse_report(str(report))
    assert parsed == {'archive_total': 12, 'kept_tweets': 7}


def test_account_needles_derive_from_email():
    needles = verify_tweets.account_needles({'email': 'Fixture@Example.com'})
    assert 'fixture@example.com' in needles
    assert 'fixture' in needles
    assert all(len(n) >= 5 for n in needles)


def test_account_needles_exclude_already_public_strings():
    needles = verify_tweets.account_needles(
        {'email': 'fixtureuser@example.com', 'username': 'fixtureuser'})
    assert 'fixtureuser' not in needles
    assert 'fixtureuser@example.com' in needles
