import pytest
import backup_paths
from wp_parser import load_dump
import categories
from categories import post_categories, build_mapping

def test_missing_row_in_edited_csv_fails_loudly(tmp_path, monkeypatch):
    csv_file = tmp_path / 'category-mapping.csv'
    csv_file.write_text('old,new\nWords,Words\n', encoding='utf-8')
    monkeypatch.setattr(categories, 'CSV_PATH', str(csv_file))
    cats = {'101': 'Words', '102': 'Journal'}   # Journal has no row in the CSV
    with pytest.raises(ValueError, match='Journal'):
        build_mapping(cats)

def test_every_published_post_gets_one_category():
    d = load_dump(backup_paths.dump_path())
    cats = post_categories(d)          # {post_id: first_category_name}
    pub = [p[0] for p in d['wp_posts'] if p[20] == 'post' and p[7] == 'publish']
    mapping = build_mapping(cats)      # {old_name: new_name}; build_mapping maps
    for pid in pub:                    # uncategorized/未分类/'' -> 随笔 itself
        old = cats.get(pid, '')
        new = mapping[old] if old else '随笔'   # KeyError/empty = real failure
        assert new and new.strip()
