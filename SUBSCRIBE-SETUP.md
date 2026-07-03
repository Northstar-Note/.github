# 구독(subscription) 저장 설정 — Cloudflare D1

구독 폼(`/#subscribe`)은 `POST /api/subscribe` → Cloudflare **D1** DB에 저장하고,
`/admin?key=...` 에서 구독자 목록을 표로 보고 CSV로 내려받는다.
D1 바인딩이 없으면 폼은 자동으로 이메일(mailto) 폴백으로 동작(구독자 유실 없음).

## 최초 1회 설정 (약 3분)

```bash
# 1) D1 DB 생성 → 출력된 database_id 를 wrangler.toml 의 REPLACE_WITH_D1_DATABASE_ID 에 붙여넣기
wrangler d1 create northstar-subscribers

# 2) 스키마 적용
wrangler d1 execute northstar-subscribers --remote --file=./schema.sql

# 3) admin 비밀번호(열람용) 설정 — 원하는 값으로
wrangler pages secret put ADMIN_KEY   # 프롬프트에 비밀번호 입력
```

또는 Cloudflare 대시보드에서:
- **Workers & Pages → 프로젝트 → Settings → Functions → D1 database bindings**:
  변수명 `DB` → `northstar-subscribers` 연결
- **Settings → Environment variables**: `ADMIN_KEY` = 원하는 비밀번호

## 확인
- 구독자 보기: `https://<도메인>/admin?key=<ADMIN_KEY>`
- CSV: `https://<도메인>/admin?key=<ADMIN_KEY>&format=csv`

## 잠긴 글 나중에 공개하기
№002·№003 은 잠금 화면으로 대체돼 있고, 원문은 각 폴더의 `full.html` 로 보존됨.
공개 시: 해당 폴더에서 `mv full.html index.html` 후 홈/목록의 잠금 카드를 링크로 복원.
