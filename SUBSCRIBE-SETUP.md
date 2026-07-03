# 구독(subscription) 저장 설정 — Cloudflare D1

> ✅ 2026-07-03 설정 완료 · 라이브 검증됨. DB `northstar-subscribers` 생성 + 테이블 적용 + `DB` 바인딩 + `ADMIN_KEY`(32-hex, 대시보드 env var) 설정. `POST /api/subscribe` → `{ok:true}`, `/admin?key=<ADMIN_KEY>` 표/CSV 정상. 아래는 재설정/참고용.

구독 폼(`/#subscribe`)은 `POST /api/subscribe` → Cloudflare **D1** DB에 저장하고,
`/admin?key=...` 에서 구독자 목록을 표로 보고 CSV로 내려받는다.
D1 바인딩이 없으면 폼은 자동으로 이메일(mailto) 폴백으로 동작(구독자 유실 없음).

## 최초 1회 설정 (약 3분)

```bash
# 1) D1 DB 생성
wrangler d1 create northstar-subscribers

# 2) 스키마 적용
wrangler d1 execute northstar-subscribers --remote --file=./schema.sql
```

그다음 **Cloudflare 대시보드**에서 사이트에 연결(빌드 안정성 때문에 바인딩은 대시보드에서):
- **Workers & Pages → 프로젝트(northstar-note) → Settings → Functions → D1 database bindings**:
  변수명 `DB` → `northstar-subscribers` 연결
- **Settings → Environment variables**: `ADMIN_KEY` 를 **암호화 Secret(Encrypt)** 으로 추가 (일반 plaintext 변수 ❌)

> ⚠️ `wrangler.toml` 에 실제 `database_id` 를 하드코딩하지 마세요 — 잘못된 값이면 Pages 빌드가 실패합니다. 바인딩은 대시보드로.

## ⚠️ 관리자 페이지가 아무 키나 401 날 때 (ADMIN_KEY 드롭 함정)

`wrangler.toml` 에 `[[d1_databases]]` 블록이 있으면 Pages 가 설정을 **이 파일에서** 읽고
대시보드의 **plaintext 환경변수를 무시**합니다. 그러면 plaintext 로 넣은 `ADMIN_KEY` 가
조용히 사라져 `/admin` 이 **모든 키에 401** 을 냅니다. (구독 저장은 D1 바인딩이
`wrangler.toml` 에 있으니 정상 — 그래서 "구독은 되는데 관리자만 깨짐" 증상.)

- **고치는 법**: `ADMIN_KEY` 를 대시보드에서 **암호화 Secret** 으로 다시 추가 → Save → 재배포.
  Secret 은 별도 저장이라 `wrangler.toml` 과 함께 있어도 적용됩니다.
- **하지 말 것**: 이걸 고치겠다고 `wrangler.toml` 의 D1 블록을 지우지 마세요 —
  DB 바인딩이 사라져 구독 폼이 깨집니다 (실제로 시도했다가 revert 된 이력 있음: `5267fc6` → `9037558`).
- 진단 팁: `ADMIN_KEY` 미설정 시 `/admin` 은 이제 401 이 아니라 **503 "ADMIN_KEY not configured"** 를
  반환하므로, 401 이면 "키 틀림", 503 이면 "서버에 키 없음" 으로 즉시 구분됩니다.

## 관리자 페이지 (구독자 열람)

라이브 도메인은 `northstar-note.pages.dev` 입니다. `<ADMIN_KEY>` 자리에 대시보드에 넣은
Secret 값을 넣어 접속하세요 (아래 링크의 `<ADMIN_KEY>` 는 자리표시자 — 실제 키를 리포에 커밋하지 말 것).

- 구독자 보기: [`https://northstar-note.pages.dev/admin?key=<ADMIN_KEY>`](https://northstar-note.pages.dev/admin?key=<ADMIN_KEY>)
- CSV 내려받기: [`https://northstar-note.pages.dev/admin?key=<ADMIN_KEY>&format=csv`](https://northstar-note.pages.dev/admin?key=<ADMIN_KEY>&format=csv)

> 응답으로 상태 확인: 정상 키 → 200(표) · 틀린 키 → 401 · 서버에 키 미설정 → 503.

## 잠긴 글 나중에 공개하기
№002·№003 은 잠금 화면으로 대체돼 있고, 원문은 각 폴더의 `full.html` 로 보존됨.
공개 시: 해당 폴더에서 `mv full.html index.html` 후 홈/목록의 잠금 카드를 링크로 복원.
