#!/usr/bin/env python3
"""북극성과 시행착오 노트 — 다음 호 공개 + 구독자 발송 파이프라인.

기본 실행 = 드라이런 (아무것도 바꾸지 않고 계획만 출력).
실제 발행·발송은 --live 일 때만, 그리고 approval.txt 승인 게이트를 통과할 때만.

흐름 (--live):
  1. 단일 실행 lock (동시 실행 차단)
  2. 격주 주기 확인 (마지막 발송 후 12일 미만이면 종료 — launchd는 매주 토요일 실행)
  3. 승인 게이트: approval.txt에 이 호(slug) 또는 ALL에 대한 APPROVED: 줄
  4. 레포 검증: branch==main + origin 확인 + clean + pull --ff-only
  5. 잠금 해제: patches/<slug>.json exact-match 적용 + full.html → index.html 스왑
     (find가 하나라도 유일 매치가 아니면 전부 되돌리고 중단 — 부분 커밋 없음)
  6. 커밋(수정 파일만 명시) + push + ls-remote로 push 실효 검증 → CF Pages 자동 배포
  7. 라이브 URL 폴링 (제목 노출 + 잠금 문구 부재)
  8. /admin CSV로 구독자 회수 (키는 macOS 키체인 'northstar-admin') + suppression.txt 필터
  9. gog 발송 — To: 발신 계정(자기), BCC 80명 배치, 배치별 durable ledger로 멱등
 10. runtime/state.json 갱신 + logs/northstar-send.log 기록

멱등성: 배치 ledger(runtime/ledger/<slug>.json)에 배치별 pending→sending→sent를
원자적으로 기록. 재실행 시 sent 배치는 건너뛰고, 'sending'(결과 불명) 배치가 있으면
자동 재발송하지 않고 중단한다 — Sent 메일함 교차확인 후 ledger를 수동 교정할 것.

--resume-email <slug>: 사이트는 공개됐는데 메일 단계에서 실패했을 때 메일만 재개.
state.sent에 이미 기록된 호는 거부한다.
"""
import argparse
import csv
import datetime
import fcntl
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

OPS = os.path.dirname(os.path.abspath(__file__))
# 이 파일이 레포 안(tools/newsletter/)에 있으면 레포 루트 자동 인식, 아니면 NORTHSTAR_REPO로 지정
_default_repo = os.path.abspath(os.path.join(OPS, "..", ".."))
REPO = os.path.expanduser(os.environ.get("NORTHSTAR_REPO", _default_repo))
REPO_ORIGIN_MARKER = "solopreneur-northstar-note"
RUNTIME = os.path.join(OPS, "runtime")          # gitignored — 실행 머신이 유일한 writer
LOG_DIR = RUNTIME
LOG = os.path.join(LOG_DIR, "send.log")
STATE = os.path.join(RUNTIME, "state.json")
LEDGER_DIR = os.path.join(RUNTIME, "ledger")
LOCK_PATH = os.path.join(RUNTIME, ".lock")
APPROVAL = os.path.join(OPS, "approval.txt")
SUPPRESSION = os.path.join(OPS, "suppression.txt")
KEYCHAIN_SERVICE = "northstar-admin"  # macOS 키체인 폴백용 (env가 우선)
SENDER = os.environ.get("NORTHSTAR_SENDER", "PENDING-NEWSLETTER-ACCOUNT")  # 뉴스레터 계정으로 교체
BCC_BATCH = 80
MIN_DAYS_BETWEEN = 12  # 격주 (사이트 약속: "격주로 한 편씩")
POLL_TRIES, POLL_WAIT = 15, 20


def log(msg):
    os.makedirs(LOG_DIR, exist_ok=True)
    ts = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    line = f"{ts} | {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def die(msg, code=1):
    log(f"ABORT: {msg}")
    sys.exit(code)


def run(cmd, cwd=REPO, check=True, redact=False):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        shown = f"{cmd[0]} [REDACTED]" if redact else " ".join(cmd)
        err = (r.stderr or "").strip()
        if redact:
            err = err[:200]  # 수신자/본문이 에러에 에코될 수 있음 — 최소만
        die(f"명령 실패 {shown}: {err[:400]}")
    return r


def atomic_write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def acquire_lock():
    os.makedirs(RUNTIME, exist_ok=True)
    fh = open(LOCK_PATH, "w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        die("다른 인스턴스가 실행 중 — 종료")
    return fh  # 프로세스 종료까지 유지


def next_issue(order, state):
    sent = {s["slug"] for s in state.get("sent", [])}
    for issue in order["issues"]:
        if issue["slug"] not in sent:
            return issue
    return None


def due_check(state, force):
    sent = state.get("sent", [])
    if not sent or force:
        return
    last = datetime.date.fromisoformat(sent[-1]["date"])
    days = (datetime.date.today() - last).days
    if days < MIN_DAYS_BETWEEN:
        log(f"격주 주기 미도래 (마지막 발송 {last}, {days}일 경과) — 종료")
        sys.exit(0)


def approval_ok(slug):
    """approval.txt에 '^APPROVED: (ALL|<slug>) ...' 줄이 있어야 통과.

    placeholder 문구가 우연히 통과하지 않도록 줄 시작 + 대상 명시를 요구한다.
    """
    if not os.path.exists(APPROVAL):
        return False
    txt = open(APPROVAL, encoding="utf-8").read()
    return bool(re.search(rf"^APPROVED:\s+(ALL|{re.escape(slug)})\b", txt, re.M))


def approval_check(slug):
    if not approval_ok(slug):
        die(f"approval.txt에 '{slug}'(또는 ALL) 승인 없음 — 형식: 'APPROVED: <slug|ALL> <날짜> <근거>'")


def repo_check():
    origin = run(["git", "remote", "get-url", "origin"]).stdout.strip()
    if REPO_ORIGIN_MARKER not in origin:
        die(f"origin이 뉴스레터 레포가 아님: {origin}")
    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    if branch != "main":
        die(f"현재 branch가 main이 아님: {branch}")
    if run(["git", "status", "--porcelain"]).stdout.strip():
        die("레포가 clean하지 않음")
    run(["git", "pull", "--ff-only"])


def apply_unlock(issue, dry):
    """검증 전부 → 그다음에만 쓰기. 검증 단계 die()는 디스크를 건드리기 전에 난다."""
    patches = load_json(os.path.join(OPS, "patches", f"{issue['slug']}.json"))
    if not patches:
        die(f"패치 파일 없음: {issue['slug']}")

    # ── 1단계: 전 항목 메모리 검증 (디스크 무변경) ──
    changed = []
    contents = {}
    for p in patches:
        path = os.path.join(REPO, p["file"])
        if path not in contents:
            contents[path] = open(path, encoding="utf-8").read()
        n = contents[path].count(p["find"])
        if n != 1:
            if n == 0 and contents[path].count(p["replace"]) == 1:
                die(
                    f"패치가 이미 적용된 상태 ({p['file']}) — 지난 실행이 push 후 실패했을 가능성. "
                    f"gen_patches 재생성이 아니라 --resume-email {issue['slug']} 검토"
                )
            die(
                f"패치 대상이 유일 매치가 아님 ({p['file']}, count={n}) — "
                "페이지가 바뀌었으면 gen_patches.py 재생성 필요"
            )
        contents[path] = contents[path].replace(p["find"], p["replace"], 1)
        changed.append(p["file"])

    full = os.path.join(REPO, "issues", issue["slug"], "full.html")
    gate = os.path.join(REPO, "issues", issue["slug"], "index.html")
    if not os.path.exists(full):
        die(f"full.html 없음: {issue['slug']}")
    body = open(full, encoding="utf-8").read()
    body = body.replace(f"issues/{issue['slug']}/full.html", f"issues/{issue['slug']}/")
    if issue["title"] not in body:
        die("full.html에 제목이 없음 — issue_order.json과 본문 불일치")

    changed += [f"issues/{issue['slug']}/index.html", f"issues/{issue['slug']}/full.html"]
    if dry:
        return sorted(set(changed))

    # ── 2단계: 쓰기 (검증 통과 후에만) ──
    for path, content in contents.items():
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    with open(gate, "w", encoding="utf-8") as f:
        f.write(body)
    os.remove(full)
    return sorted(set(changed))


def commit_and_push(issue, files, pre_head):
    try:
        run(["git", "add", "--"] + files)
        run(["git", "commit", "-m", f"feat(newsletter): publish № {issue['no']} — {issue['slug']}"])
        run(["git", "push", "origin", "main"])
        # push 실효 검증: 원격 main == 로컬 HEAD (feature-branch push 착시 방지)
        local = run(["git", "rev-parse", "HEAD"]).stdout.strip()
        remote = run(["git", "ls-remote", "origin", "refs/heads/main"]).stdout.split()
        if not remote or remote[0] != local:
            die(f"push 검증 실패: 원격 main({remote[0][:8] if remote else '?'}) != 로컬 HEAD({local[:8]})")
        log(f"push 완료+검증: № {issue['no']} {issue['slug']} @ {local[:8]}")
    except SystemExit:
        # add/commit/push/검증 어디서 실패했든 워킹트리+인덱스+HEAD를 실행 전으로.
        # (git checkout -- . 은 '인덱스'에서 복원하므로 add 이후엔 무효 — reset --hard가 정답.
        #  push가 실제로는 성공했는데 검증만 실패한 경우에도 다음 실행 pull이 원격 커밋을
        #  다시 가져오고, apply_unlock의 '이미 적용됨' 감지가 --resume-email로 안내한다.)
        run(["git", "reset", "--hard", pre_head], check=False)
        log(f"실패 롤백: git reset --hard {pre_head[:8]}")
        raise


def poll_live(issue):
    url = f"https://northstar-note.pages.dev/issues/{issue['slug']}/"
    for i in range(POLL_TRIES):
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                html = r.read().decode("utf-8", "replace")
            if issue["title"] in html and "곧 공개" not in html and "공개 준비" not in html:
                log(f"라이브 확인: {url}")
                return url
        except Exception as e:
            log(f"폴링 대기 ({i+1}/{POLL_TRIES}): {type(e).__name__}")
        time.sleep(POLL_WAIT)
    die(f"배포 확인 실패 — 메일 미발송. 수동 확인 후 --resume-email {issue['slug']} 로 재개")


def admin_key():
    # 1순위: 환경변수 (어느 OS든), 2순위: macOS 키체인. 코드/레포에 키를 넣지 말 것.
    env = os.environ.get("NORTHSTAR_ADMIN_KEY", "").strip()
    if env:
        return env
    r = subprocess.run(
        ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
        capture_output=True, text=True,
    )
    if r.returncode != 0 or not r.stdout.strip():
        die(
            "ADMIN_KEY 없음 — env NORTHSTAR_ADMIN_KEY 설정 또는 (macOS) "
            f"security add-generic-password -s {KEYCHAIN_SERVICE} -a newsletter -w <KEY>"
        )
    return r.stdout.strip()


def load_suppression():
    if not os.path.exists(SUPPRESSION):
        return set()
    out = set()
    for line in open(SUPPRESSION, encoding="utf-8"):
        line = line.strip().lower()
        if line and not line.startswith("#"):
            out.add(line)
    return out


def fetch_subscribers(key):
    url = f"https://northstar-note.pages.dev/admin?key={key}&format=csv"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        die(f"/admin 응답 {e.code} — 키/서버 상태 확인")  # URL(키 포함)은 로그 금지
    except Exception as e:
        die(f"/admin fetch 실패: {type(e).__name__}")
    suppressed = load_suppression()
    emails, dropped = [], 0
    for row in csv.DictReader(io.StringIO(data)):
        e = (row.get("email") or "").strip().lower()
        if not e or "@" not in e or e in emails:
            continue
        if e in suppressed:
            dropped += 1
            continue
        emails.append(e)
    if dropped:
        log(f"suppression 제외: {dropped}명")
    if not emails:
        die("구독자 0명 — 발송 중단")
    return emails


def normalize_copy(s):
    """외부 문구 규칙: em dash 금지."""
    return s.replace(" — ", " - ").replace("—", "-")


def render_email(issue, order):
    tpl = open(os.path.join(OPS, "email_template.html"), encoding="utf-8").read()
    url = f"{order['site']}/issues/{issue['slug']}/"
    kicker = normalize_copy(issue["kicker"])
    title = normalize_copy(issue["title"])
    deck = normalize_copy(issue["deck"])
    for k, v in [
        ("{{NO}}", issue["no"]), ("{{KICKER}}", kicker),
        ("{{TITLE}}", title), ("{{DECK}}", deck),
        ("{{URL}}", url), ("{{SITE}}", order["site"]),
    ]:
        tpl = tpl.replace(k, v)
    subject = f"№ {issue['no']} · {title} · {order['newsletter_name']}"
    plain = (
        f"{order['newsletter_name']} · № {issue['no']}\n\n{kicker}\n"
        f"{title}\n\n{deck}\n\n전문 읽기: {url}\n\n"
        "그만 받고 싶으시면 이 메일에 '해지'라고 회신해 주세요. 다음 호부터 빼드립니다."
    )
    return subject, tpl, plain


def load_or_create_ledger(issue, subject, emails):
    path = os.path.join(LEDGER_DIR, f"{issue['slug']}.json")
    ledger = load_json(path)
    if ledger is None:
        batches = [emails[i:i + BCC_BATCH] for i in range(0, len(emails), BCC_BATCH)]
        ledger = {
            "slug": issue["slug"], "subject": subject,
            "batches": [
                {"n": i + 1, "emails": b, "status": "pending", "message_id": None}
                for i, b in enumerate(batches)
            ],
        }
        atomic_write(path, ledger)
        return path, ledger
    # 기존 ledger 재개: 결과 불명 배치는 자동 재발송 금지
    stuck = [b["n"] for b in ledger["batches"] if b["status"] == "sending"]
    if stuck:
        die(
            f"ledger에 결과 불명 배치 {stuck} — 자동 재발송 금지. "
            f"발신 계정 Sent 메일함 교차확인 후 {path} 의 status를 sent/pending으로 수동 교정"
        )
    log(f"기존 ledger 재개: {path}")
    return path, ledger


def send_batches(issue, subject, html, plain, emails, dry):
    if dry:
        n = (len(emails) + BCC_BATCH - 1) // BCC_BATCH
        log(f"[dry-run] {len(emails)}명 → {n}개 배치 (미발송)")
        return len(emails)
    path, ledger = load_or_create_ledger(issue, subject, emails)
    total = len(ledger["batches"])
    for b in ledger["batches"]:
        if b["status"] == "sent":
            log(f"배치 {b['n']}/{total}: 이미 발송됨 — 건너뜀")
            continue
        b["status"] = "sending"
        atomic_write(path, ledger)
        # ─── 환경 어댑트 지점: 발송 커맨드 ───────────────────────────────
        # 아래는 gog CLI 기준. 다른 메일 도구(Gmail API 직접/SMTP 등)를 쓰면
        # 이 커맨드만 교체하면 된다. 계약: To=발신자 자신, BCC=b["emails"],
        # subject/plain/html 그대로, 실패는 예외/exit로 중단돼야 ledger가 지켜짐.
        cmd = [
            "gog", "gmail", "send", "--account", SENDER, "--no-input", "--json",
            "--to", SENDER, "--bcc", ",".join(b["emails"]),
            "--subject", subject, "--body", plain, "--body-html", html,
        ]
        r = run(cmd, cwd=OPS, redact=True)
        try:
            b["message_id"] = json.loads(r.stdout).get("id")
        except Exception:
            b["message_id"] = "unparsed"
        b["status"] = "sent"
        atomic_write(path, ledger)
        log(f"발송 배치 {b['n']}/{total}: {len(b['emails'])}명, message={b['message_id']}")
        time.sleep(5)
    return sum(len(b["emails"]) for b in ledger["batches"])


def record(issue, count, state):
    state.setdefault("sent", []).append({
        "slug": issue["slug"], "no": issue["no"],
        "date": datetime.date.today().isoformat(), "recipients": count,
    })
    atomic_write(STATE, state)
    log(f"완료: № {issue['no']} → 구독자 {count}명")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="실제 발행+발송 (기본은 드라이런)")
    ap.add_argument("--force", action="store_true", help="격주 주기 무시")
    ap.add_argument("--resume-email", metavar="SLUG", help="사이트는 이미 공개됨 — 메일 단계만 재개")
    args = ap.parse_args()
    dry = not args.live

    lock = acquire_lock()  # noqa: F841 — 프로세스 생존 동안 유지
    order = load_json(os.path.join(OPS, "issue_order.json"))
    state = load_json(STATE, {"sent": []})

    if args.resume_email:
        if any(s["slug"] == args.resume_email for s in state.get("sent", [])):
            die(f"{args.resume_email} 는 이미 발송 완료로 기록됨 — resume 거부")
        issue = next((i for i in order["issues"] if i["slug"] == args.resume_email), None)
        if issue is None:
            die(f"issue_order.json에 없는 slug: {args.resume_email}")
        if not dry:
            approval_check(issue["slug"])
        poll_live(issue)
        emails = fetch_subscribers(admin_key())
        subject, html, plain = render_email(issue, order)
        count = send_batches(issue, subject, html, plain, emails, dry)
        if not dry:
            record(issue, count, state)
        return

    issue = next_issue(order, state)
    if issue is None:
        log("남은 호 없음 — 종료")
        return
    due_check(state, args.force or dry)
    if not dry:
        approval_check(issue["slug"])
        if "PENDING" in SENDER:
            die("발신 계정 미확정 — SENDER 교체 필요")

    if not dry:
        repo_check()
    pre_head = run(["git", "rev-parse", "HEAD"]).stdout.strip()
    files = apply_unlock(issue, dry)
    subject, html, plain = render_email(issue, order)

    if dry:
        print("\n=== 드라이런 계획 ===")
        print(f"다음 호: № {issue['no']} {issue['slug']}")
        print(f"수정 파일: {files}")
        print(f"메일 제목: {subject}")
        key_ok = bool(os.environ.get("NORTHSTAR_ADMIN_KEY")) or subprocess.run(
            ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE],
            capture_output=True).returncode == 0
        print(f"키체인 admin key: {'있음' if key_ok else '❌ 없음'}")
        print(f"승인: {'APPROVED' if approval_ok(issue['slug']) else '❌ 승인 대기'}")
        print(f"발신 계정: {SENDER}{' ❌ 미확정' if 'PENDING' in SENDER else ''}")
        return

    commit_and_push(issue, files, pre_head)
    poll_live(issue)
    emails = fetch_subscribers(admin_key())
    count = send_batches(issue, subject, html, plain, emails, dry)
    record(issue, count, state)


if __name__ == "__main__":
    main()
