import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")


def assert_uses_shared_component_mount(page: str, script_src: str) -> None:
    html = read(page)
    assert re.search(
        r'<section class="subscribe" id="subscribe" data-subscribe-component>\s*</section>',
        html,
    )
    assert f'src="{script_src}"' in html
    assert 'data-subscribe-form' not in html
    assert '<form' not in html
    assert 'fetch(' not in html


def test_home_and_about_use_the_same_subscribe_component_mount():
    assert_uses_shared_component_mount("index.html", "assets/subscribe.js")
    assert_uses_shared_component_mount("about/index.html", "../assets/subscribe.js")


def test_subscribe_markup_lives_once_in_the_shared_component_script():
    script = read("assets/subscribe.js")
    assert '<form data-subscribe-form>' in script
    assert 'label for="sub-name"' in script
    assert 'input id="sub-name" name="name"' in script
    assert 'label for="sub-email"' in script
    assert 'input id="sub-email" name="email"' in script
    assert 'class="done"' in script


def test_shared_subscribe_script_posts_only_to_canonical_api_endpoint():
    script = read("assets/subscribe.js")
    assert "SUBSCRIBE_ENDPOINT = '/api/subscribe'" in script
    assert "fetch(SUBSCRIBE_ENDPOINT" in script
    assert script.count("/api/subscribe") == 1


def test_about_page_does_not_define_a_separate_subscription_endpoint_or_store():
    html = read("about/index.html")
    assert "formspree" not in html.lower()
    assert "airtable" not in html.lower()
    assert "newsletter" not in html.lower()
    assert "action=" not in html
