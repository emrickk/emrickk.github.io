from add_hero_images import (build_hero_line, first_image_ref, has_hero_image,
                             insert_hero_image)


# ── first-image extraction (incl. extension filtering) ─────────────────────
def test_first_image_ref_returns_first_image():
    body = ('![](/uploads/2023/03/BMW-X3-14.jpeg)\n'
            '![](/uploads/2023/03/BMW-X3-13.jpeg)')
    assert first_image_ref(body) == '2023/03/BMW-X3-14.jpeg'


def test_first_image_ref_skips_non_image_extensions():
    # The FIRST uploads ref is a PDF, then an mp3, then a real image. Since
    # emitted_img_re matches any uploads ref, extension filtering must skip the
    # non-images and land on the first IMAGE.
    body = ('[doc](/uploads/2021/05/report.pdf)\n'
            '[audio](/uploads/2021/05/track.mp3)\n'
            '[archive](/uploads/2021/05/bundle.zip)\n'
            '![](/uploads/2021/05/photo.png)')
    assert first_image_ref(body) == '2021/05/photo.png'


def test_first_image_ref_none_when_only_non_images():
    body = ('[doc](/uploads/2021/05/report.pdf)\n'
            '[zip](/uploads/2021/05/bundle.zip)')
    assert first_image_ref(body) is None


def test_first_image_ref_none_when_no_uploads():
    assert first_image_ref('plain text, no images here at all') is None


def test_first_image_ref_accepts_all_image_extensions():
    for ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'JPG', 'PNG', 'JPEG'):
        body = f'![](/uploads/2020/01/x.{ext})'
        assert first_image_ref(body) == f'2020/01/x.{ext}'


def test_first_image_ref_picks_first_of_several_images():
    body = ('![](/uploads/2020/01/a.png)\n'
            '![](/uploads/2020/02/b.jpg)\n'
            '![](/uploads/2020/03/c.gif)')
    assert first_image_ref(body) == '2020/01/a.png'


# ── idempotent frontmatter insertion ───────────────────────────────────────
def test_insert_hero_image_after_pubdate():
    text = ("---\ntitle: 'T'\ndescription: ''\npubDate: '2023-03-01'\n"
            "category: 'Prodigal'\n---\n\nBody text\n")
    out = insert_hero_image(text, '2023/03/BMW-X3-14.jpeg')
    lines = out.split('\n')
    pub_i = next(i for i, l in enumerate(lines) if l.startswith('pubDate'))
    assert lines[pub_i + 1] == "heroImage: '../../assets/hero/2023/03/BMW-X3-14.jpeg'"
    # body preserved verbatim after the frontmatter
    assert out.endswith('\n\nBody text\n')


def test_insert_hero_image_falls_back_to_category_without_pubdate():
    text = "---\ntitle: 'T'\ncategory: 'Prodigal'\n---\nBody\n"
    out = insert_hero_image(text, '2023/03/x.jpg')
    lines = out.split('\n')
    cat_i = next(i for i, l in enumerate(lines) if l.startswith('category'))
    assert lines[cat_i + 1] == "heroImage: '../../assets/hero/2023/03/x.jpg'"


def test_insert_hero_image_idempotent():
    text = "---\ntitle: 'T'\npubDate: '2023-03-01'\n---\nBody\n"
    once = insert_hero_image(text, '2023/03/x.jpg')
    twice = insert_hero_image(once, '2023/03/x.jpg')
    assert once == twice
    assert once.count('heroImage:') == 1


def test_insert_hero_image_leaves_existing_untouched():
    text = ("---\ntitle: 'T'\npubDate: '2023-03-01'\n"
            "heroImage: '../../assets/hero/2023/03/original.jpg'\n---\nBody\n")
    out = insert_hero_image(text, '2023/03/different.png')
    assert out == text
    assert 'different.png' not in out


def test_insert_hero_image_adds_exactly_one_line():
    text = "---\ntitle: 'T'\npubDate: '2023-03-01'\ncategory: 'X'\n---\nBody\n"
    out = insert_hero_image(text, '2023/03/x.jpg')
    assert out.count('heroImage:') == 1
    assert len(out.split('\n')) == len(text.split('\n')) + 1


def test_has_hero_image():
    assert has_hero_image("---\ntitle: 'T'\nheroImage: '../../assets/hero/a.jpg'\n---\nB")
    assert not has_hero_image("---\ntitle: 'T'\npubDate: '2020-01-01'\n---\nB")


def test_build_hero_line():
    assert build_hero_line('2023/03/x.jpeg') == \
        "heroImage: '../../assets/hero/2023/03/x.jpeg'"
