from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")


def test_home_and_about_use_the_same_subscribe_component():
    pages = {
        "index.html": "assets/subscribe.js",
        "about/index.html": "../assets/subscribe.js",
    }

    for page, script_src in pages.items():
        html = read(page)
        assert 'class="subscribe" id="subscribe"' in html
        assert 'data-subscribe-form' in html
        assert 'name="name"' in html
        assert 'name="email"' in html
        assert f'src="{script_src}"' in html


def test_shared_subscribe_script_posts_only_to_canonical_api_endpoint():
    script = read("assets/subscribe.js")
    assert "SUBSCRIBE_ENDPOINT = '/api/subscribe'" in script
    assert "fetch(SUBSCRIBE_ENDPOINT" in script
    assert script.count("/api/subscribe") == 1


def test_about_page_does_not_define_a_separate_subscription_endpoint_or_store():
    html = read("about/index.html")
    assert "fetch(" not in html
    assert "formspree" not in html.lower()
    assert "airtable" not in html.lower()
    assert "newsletter" not in html.lower()
    assert "action=" not in html
