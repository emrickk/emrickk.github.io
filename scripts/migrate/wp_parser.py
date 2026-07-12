"""Parse INSERT statements from a MySQL dump without a MySQL server."""
import os

TABLES = ('wp_posts', 'wp_comments', 'wp_users', 'wp_postmeta',
          'wp_terms', 'wp_term_taxonomy', 'wp_term_relationships')

def parse_tuples(line):
    rows, i, n = [], line.index('('), len(line)
    while i < n:
        if line[i] != '(':
            i += 1; continue
        i += 1
        fields, buf, in_str = [], [], False
        while i < n:
            c = line[i]
            if in_str:
                if c == '\\' and i + 1 < n:  # bounds-checked; a lone trailing '\' falls through and is kept literally
                    esc = line[i+1]
                    buf.append({'n':'\n','t':'\t','r':'\r','0':'\0',
                                '\\':'\\',"'":"'",'"':'"'}.get(esc, esc))
                    i += 2; continue
                if c == "'": in_str = False; i += 1; continue
                buf.append(c); i += 1; continue
            if c == "'": in_str = True; buf.append(''); i += 1; continue
            if c == ',':
                s = ''.join(buf); fields.append(None if s == 'NULL' else s)
                buf = []; i += 1; continue
            if c == ')':
                s = ''.join(buf); fields.append(None if s == 'NULL' else s)
                rows.append(fields); i += 1; break
            buf.append(c); i += 1
    return rows

def load_dump(path):
    """Load the dump at `path` (relative to this file) into {table: [row, ...]}.

    Rows are lists of str/None indexed by the table's column order.
    Field indices downstream code relies on:

    wp_posts:
        0 ID, 1 author, 2 date, 4 content, 5 title, 7 status,
        11 name/slug, 17 parent, 18 guid, 20 type
    wp_comments:
        0 ID, 1 post_ID, 2 author, 3 email, 4 url, 5 IP, 6 date,
        8 body, 10 approved
    wp_terms:
        0 term_id, 1 name
    wp_term_taxonomy:
        0 tt_id, 1 term_id, 2 taxonomy
    wp_term_relationships:
        0 object_id, 1 tt_id
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
    out = {t: [] for t in TABLES}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            for t in TABLES:
                if line.startswith(f'INSERT INTO `{t}`'):
                    out[t].extend(parse_tuples(line)); break
    return out
