# 뉴스레터 자동 발행+발송 파이프라인 (tools/newsletter)

잠긴 호를 №001 창간호부터 순서대로 **격주 토요일 10:00 KST**에 자동 공개하고,
공개 확인 후 구독자에게 이메일을 보내는 파이프라인입니다. 코드는 전부 여기 있고,
**발송 계정 연결 + 스케줄 등록만 하면 돌아갑니다.**

> 🤖 AI 어시스턴트(Claude Code 등)에게 맡기려면 맨 아래 "AI에게 줄 프롬프트"를 그대로 붙여넣으세요.

## 무엇을 하나 (send_next_issue.py --live)

1. state에서 다음 호 결정 (issue_order.json 순서) + 격주 주기 확인 (12일 미만이면 스스로 종료 — 스케줄러는 매주 토요일 등록)
2. 승인 게이트: `runtime/approval.txt`에 `APPROVED: <slug 또는 ALL> <날짜> <메모>` 줄 (매 호 확인용 스위치, gitignored라 커밋 불필요 — 형식은 approval.example.txt)
3. 레포 검증: branch==main + clean + pull --ff-only
4. 잠금 해제 (검증 전부 통과 후에만 쓰기): patches/<slug>.json exact-match 적용(홈 히어로·공지바·발행목록 카드) + full.html→index.html 스왑 + og:url 교정
   - 누가 페이지를 고쳐서 패치가 안 맞으면 **디스크 무변경으로 중단** → `python3 gen_patches.py` 재생성 후 재시도
5. 커밋(수정 파일만) + push + ls-remote로 push 실효 검증 → Cloudflare Pages 자동 배포. 실패 시 `git reset --hard <실행 전>` 롤백
6. 라이브 URL 폴링 (제목 노출 + "곧 공개" 부재)
7. 구독자 회수: `/admin?key=...&format=csv` + runtime/suppression.txt(수신거부) 제외 + **480명 하드캡** (개인 Gmail 24h 한도 fail-closed)
8. 발송: To=발신 계정 자신, **BCC 80명 배치** (주소 상호 비노출). 배치별 ledger(runtime/ledger/)로 **중복 발송 방지** — 재실행 시 보낸 배치는 스킵, 결과 불명 배치는 자동 재발송 없이 멈추고 Sent 함 확인을 요구
9. runtime/state.json + runtime/send.log 기록

기본 실행 = **드라이런** (`python3 send_next_issue.py` — 아무것도 안 바꾸고 계획만 출력).
`--live`만 실제 발행+발송. `--resume-email <slug>` = 사이트만 공개되고 메일이 실패했을 때 메일 재개.

## 세팅 (5분 + 메일 도구)

1. **발신 계정**: env `NORTHSTAR_SENDER=뉴스레터주소` (또는 스크립트 상단 SENDER 교체)
2. **발송 커맨드**: send_next_issue.py의 `환경 어댑트 지점` 주석 참조 — 기본은 gog CLI(Gmail),
   다른 도구(Gmail API/SMTP)를 쓰면 그 커맨드 한 곳만 교체
3. **ADMIN_KEY**: env `NORTHSTAR_ADMIN_KEY` (macOS면 키체인 `northstar-admin`도 됨). **코드/레포에 넣지 말 것**
4. **드라이런** → **1명 테스트 발송** (자기 주소로) → runtime/approval.txt에 승인 줄 → 스케줄 등록
5. **스케줄**: 매주 토요일 10:00 KST에 `python3 tools/newsletter/send_next_issue.py --live`
   - macOS: example-launchd.plist 참고 / Linux: cron `0 10 * * 6` (TZ 확인) / Windows: 작업 스케줄러
   - **자동화 전용 클론 권장**: 평소 작업하는 checkout 말고 `git clone`을 하나 더 떠서 거기서 실행
     (branch/clean 검사가 있어 잘못돼도 안전 중단은 되지만, 작업 중인 브랜치 때문에 토요일 발행이 skip되는 걸 막으려면 격리가 정석)

## 운영 메모

- **새 호 추가 시**: issue_order.json에 항목 추가 + `python3 gen_patches.py` 재생성 (홈/발행목록 카드가 지금 패턴이어야 함)
- **수신거부**: '해지' 회신 받으면 `runtime/suppression.txt`에 이메일 한 줄 추가 (gitignored — 해지 주소는 레포에 커밋하지 않음. 형식은 suppression.example.txt 참조). 재실행/재개 시 pending 배치에도 자동 재적용
- **Gmail 개인 계정 한도**: 수신자 ≈500/24h → 구독자 ~480명이 실링. 넘으면 Workspace/발송 서비스로
- 사이트 페이지 구조를 크게 바꾸면 패치가 안 맞아 안전 중단됩니다 — gen_patches.py 재생성이 해법
- EN 페이지(issues/en/)는 이 파이프라인이 건드리지 않습니다

## AI에게 줄 프롬프트 (복붙용)

```
레포 tools/newsletter/README.md를 읽고 뉴스레터 자동 발송을 내 환경에 세팅해줘.

- 발신 계정: <뉴스레터 Gmail 주소> — 내 환경의 메일 발송 수단(gog/Gmail API/SMTP 중 가능한 것)으로
  send_next_issue.py의 '환경 어댑트 지점' 커맨드만 교체
- NORTHSTAR_SENDER / NORTHSTAR_ADMIN_KEY 는 환경변수로 (키를 코드나 레포에 넣지 마)
- 나머지 로직(잠금 해제 패치, 배포 검증, 중복 방지 ledger, 수신거부)은 그대로 사용
- 실행 위치: 자동화 전용 클론을 하나 새로 떠서 거기서 돌려 (내 작업 checkout 말고)
- 순서: ①드라이런 실행해서 계획 보여줘 ②내 주소로 테스트 1통 ③내가 OK 하면
  runtime/approval.txt에 승인 줄 넣고 격주 토요일 10:00 KST 스케줄 등록 (매주 등록, 격주는 스크립트가 알아서)
- 절대 규칙: 테스트 전에 전체 구독자에게 보내지 마. 실패하면 재발송 전에 ledger 상태를 나한테 보여줘.
```
