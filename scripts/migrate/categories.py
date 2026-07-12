"""Map WordPress categories to the theme's single-category scheme."""
import csv, os

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, 'category-mapping.csv')

def post_categories(dump):
    terms = {t[0]: t[1] for t in dump['wp_terms']}                 # term_id -> name
    tax = {}                                                        # tt_id -> (taxonomy, term name)
    for row in dump['wp_term_taxonomy']:                            # tt_id, term_id, taxonomy, ...
        tax[row[0]] = (row[2], terms.get(row[1], ''))
    out = {}
    for rel in dump['wp_term_relationships']:                       # object_id, tt_id, order
        kind, name = tax.get(rel[1], ('', ''))
        if kind == 'category' and rel[0] not in out:
            out[rel[0]] = name
    return out

def build_mapping(cats):
    """Load owner-editable CSV if present; else generate identity mapping and write it.

    A hand-edited CSV must fail loudly, never silently fall back: a bad header
    or a missing category row raises ValueError so owner mistakes surface at
    the review checkpoint instead of leaking into the migration.
    """
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            if reader.fieldnames != ['old', 'new']:
                raise ValueError(
                    f"category-mapping.csv must have header 'old,new'; "
                    f"found {reader.fieldnames!r}")
            loaded = {r['old']: r['new'] for r in reader}
        missing = sorted(set(cats.values()) - {''} - set(loaded))
        if missing:
            raise ValueError(
                f"category-mapping.csv is missing rows for: {missing}. "
                f"Add 'old,new' rows for these categories.")
        return loaded
    names = sorted(set(cats.values()) - {''})
    mapping = {n: ('随笔' if n.lower() in ('uncategorized', '未分类') else n) for n in names}
    with open(CSV_PATH, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['old', 'new']); w.writeheader()
        for old, new in mapping.items():
            w.writerow({'old': old, 'new': new})
    return mapping
