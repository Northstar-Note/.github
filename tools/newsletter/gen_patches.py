#!/usr/bin/env python3
"""잠금 해제 패치 생성기 — 북극성과 시행착오 노트.

현재 레포의 카드 HTML을 읽어, 각 호를 공개 상태로 바꾸는
exact-match find/replace 패치(patches/<slug>.json)를 만든다.
발송 스크립트(send_next_issue.py)는 이 패치를 그대로 적용만 한다 —
find 문자열이 레포에서 사라졌으면(누가 페이지를 고쳤으면) 적용을 거부하고 멈춘다.

레포 페이지가 바뀌면 이 스크립트를 다시 돌려 패치를 재생성한다.
"""
import json
import os
import re
import sys

OPS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.expanduser(os.environ.get("NORTHSTAR_REPO", os.path.abspath(os.path.join(OPS, "..", ".."))))


def load(path):
    with open(os.path.join(REPO, path), encoding="utf-8") as f:
        return f.read()


def find_card_block(html, marker, start_tag, indent):
    """marker를 포함하는 start_tag 블록(같은 indent의 </div>까지)을 돌려준다."""
    close = "\n" + " " * indent + "</div>"
    idx = 0
    while True:
        s = html.find(start_tag, idx)
        if s == -1:
            raise SystemExit(f"카드 시작 태그를 못 찾음: {marker}")
        e = html.find(close, s)
        if e == -1:
            raise SystemExit(f"카드 닫는 태그를 못 찾음: {marker}")
        block = html[s : e + len(close)]
        if marker in block:
            return block
        idx = s + len(start_tag)


def issues_list_patch(issue):
    """issues/index.html: div.ientry → a.ientry 링크 카드."""
    html = load("issues/index.html")
    marker = f"№ {issue['no']} ·"
    block = find_card_block(html, marker, '<div class="ientry">', 4)
    new = block.replace(
        '<div class="ientry">', f'<a class="ientry" href="{issue["slug"]}/">', 1
    )
    # 마지막 닫는 태그만 </a>로
    new = new[: new.rfind("</div>")] + "</a>"
    # "다음 호" 칩은 공개되면 제거, "창간호" 칩은 유지
    new = re.sub(r'\s*<span class="chip">다음 호</span>', "", new, count=1)
    # read 라벨: "… 곧 공개" → "전문 읽기 →"
    new = re.sub(
        r'<span class="read">[^<]*곧 공개</span>',
        '<span class="read">전문 읽기 →</span>',
        new,
        count=1,
    )
    if new == block:
        raise SystemExit(f"변환 결과가 원본과 동일: {issue['slug']}")
    return {"file": "issues/index.html", "find": block, "replace": new}


def home_patches(issue):
    """index.html(홈): №001은 히어로 커버를 링크로, №002+는 예고 카드 제거."""
    html = load("index.html")
    patches = []
    if issue["no"] == "001":
        find1 = '<a class="cover" href="#subscribe">'
        assert html.count(find1) == 1, "히어로 커버 앵커가 유일하지 않음"
        patches.append(
            {
                "file": "index.html",
                "find": find1,
                "replace": f'<a class="cover" href="issues/{issue["slug"]}/">',
            }
        )
        m = re.search(r'<span class="cover-soon"[^>]*>.*?</span>', html, re.S)
        if not m:
            raise SystemExit("cover-soon 스팬을 못 찾음")
        patches.append(
            {
                "file": "index.html",
                "find": m.group(0),
                "replace": '<span class="cover-soon">창간호 읽기 →</span>',
            }
        )
        # 상단 공지 바: "창간호를 준비하고 있어요 · 미리 구독하기" → 창간호 발행 안내
        ann_find = (
            "    <span>창간호를 준비하고 있어요</span>\n"
            '    <a href="#subscribe">미리 구독하기 →</a>'
        )
        if html.count(ann_find) != 1:
            raise SystemExit("공지 바 블록이 유일하게 매치되지 않음")
        patches.append(
            {
                "file": "index.html",
                "find": ann_find,
                "replace": (
                    "    <span>창간호가 나왔어요</span>\n"
                    f'    <a href="issues/{issue["slug"]}/">지금 읽기 →</a>'
                ),
            }
        )
    else:
        marker = f"№ {issue['no']} ·"
        block = find_card_block(html, marker, '<div class="card">', 4)
        patches.append({"file": "index.html", "find": block + "\n", "replace": ""})
    return patches


def main():
    order = json.load(open(os.path.join(OPS, "issue_order.json"), encoding="utf-8"))
    outdir = os.path.join(OPS, "patches")
    os.makedirs(outdir, exist_ok=True)
    for issue in order["issues"]:
        patches = [issues_list_patch(issue)] + home_patches(issue)
        out = os.path.join(outdir, f"{issue['slug']}.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(patches, f, ensure_ascii=False, indent=2)
        print(f"OK {issue['slug']}: {len(patches)} patches → {out}")


if __name__ == "__main__":
    sys.exit(main())
