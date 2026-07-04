# 북극성과 시행착오 노트

솔로프리너 클럽의 격주 발행 노트. **빌드 과정이 없는 순수 정적 사이트**(HTML/CSS/이미지)입니다.

## 구조

```
.
├── index.html            # 홈
├── about/index.html      # 소개
├── issues/               # 발행 목록 및 개별 이슈
│   └── */index.html
└── assets/               # style.css, 이미지, 파비콘
```

빌드 도구, 번들러, 프레임워크가 없습니다. `index.html`을 브라우저로 바로 열어도 동작합니다.

## 로컬에서 보기

정적 파일이라 아무 정적 서버나 쓰면 됩니다.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Cloudflare Pages 배포

이 저장소는 **빌드가 없는 정적 사이트**이므로 배포 설정이 핵심입니다. 배포가 안 됐다면 대부분 아래 설정 때문입니다.

### 대시보드(Git 연동) 배포 시

Cloudflare Pages → 프로젝트 → **Settings → Builds & deployments** 에서:

| 항목 | 값 |
| --- | --- |
| Framework preset | **None** |
| Build command | **(비워둠)** |
| Build output directory | **`/`** (저장소 루트) |
| Root directory | **(비워둠 / `/`)** |

- Build command에 값이 들어가 있으면 존재하지 않는 스크립트를 실행하려다 배포가 실패합니다. 반드시 **비워두세요.**
- 정적 파일이 루트에 있으므로 output directory는 `dist`나 `build`가 아니라 **`/`** 입니다.
- 배포 브랜치는 **Settings → Builds & deployments → Production branch**에서 `main`인지 확인하세요.

### Wrangler CLI 배포 시

`.wrangler/`는 `.gitignore`에 있으니 커밋되지 않습니다. 명령으로 직접 올립니다.

```bash
# 최초 1회 로그인
npx wrangler login

# 현재 디렉터리(루트)를 그대로 업로드
npx wrangler pages deploy . --project-name=solopreneur-northstar-note
```

> `wrangler pages deploy` 뒤에는 **업로드할 디렉터리**가 옵니다. 빌드가 없으므로 루트(`.`)를 지정합니다.

## 배포가 계속 실패할 때 체크리스트

1. Build command가 비어 있는가? (가장 흔한 원인)
2. Build output directory가 `/`인가?
3. Production branch가 실제 푸시한 브랜치와 같은가?
4. 저장소 루트에 `index.html`이 있는가? (있음)
5. 외부 리소스(폰트 CDN 등)는 HTTPS로 로드되는가? (있음)

---

# 디자인 & 기여 가이드

새 이슈를 **바이브 코딩(AI)으로 직접 만들어 PR**할 수 있게 정리했습니다. 핵심 원칙: **새 색·폰트·컴포넌트를 만들지 말고, 이미 있는 `assets/style.css`의 클래스만 재사용**합니다. 디자인 시스템의 원리는 저장소 루트 `design.md`(Raus 스타일)와 아래를 따릅니다.

컨셉: **"크림 종이 위에 찍힌 뉴스레터"** — 조용한 크림 캔버스 위에서 타이포가 일을 하고, 마리골드 구독 카드가 페이지의 유일한 외침이 됩니다.

라이브 디자인 가이드(스와치·타이포·컴포넌트 실물): **https://northstar-note.pages.dev/guide/**

## 디자인 토큰 (`assets/style.css` `:root`)

| 역할 | 토큰 | 값 |
| --- | --- | --- |
| 유일한 텍스트 색 · 헤어라인 · 다크 패널 | `--charcoal` | `#23212c` |
| 크림 캔버스(모든 배경) | `--paper` | `#f7f0e1` |
| 카드 서피스(크림 위 앞선 면) | `--snow` | `#ffffff` |
| **Pine — 워드마크·h1·링크·킥커·role만** | `--pine` | `#006434` |
| **Marigold — 구독 카드·칩·strong만** | `--marigold` | `#fcbd1c` |
| Morning Sky — 홈 공지 바만 | `--morning-sky` | `#a6dfff` |
| Ember — 공지 바 링크 밑줄 색만 | `--ember` | `#dd5000` |

파생: `--muted` rgba(35,33,44,.64) · `--paint` .45 · `--hair` .14 · `--hair-2` .35(인풋) · `--ghost` .06(고스트 숫자) · `--mari-hl` rgba(252,189,28,.45)(하이라이터).

- 서체: **워드마크(로고)만 `Ria Sans`(800, `assets/fonts/` 로컬 · 글리프 서브셋 10KB) · 대형 워드마크 clamp(26–40px), 제목·본문은 `Pretendard`(CDN)**. `--font-logo`(로고) / `--font-display`(제목=Pretendard) / `--font-body`(본문).
  - Ria Sans는 **오직 워드마크(로고)에만**. 제목(h1~h3·고스트 숫자·풀쿼트·강령 번호)·본문·메타·버튼·폼은 모두 **Pretendard(250~700)**. 타이포 보이스(Raus 300 속삭임): 대형 디스플레이 **300** · 섹션·커버·풀쿼트 **400** · 카드·멤버 소형 제목 **500** · 고스트·강령 숫자 **200–250** · eyebrow·메타 500–600 · 버튼·CTA 600 · strong 700. **대형 제목을 800으로 두껍게 쓰지 않습니다** — 두께가 아니라 크기·여백으로 존재감. 폰트 파일이 워드마크 글리프 서브셋이라 **워드마크 문구를 바꾸면 재서브셋**해야 합니다.
- **색 규율**: 텍스트는 Charcoal 하나. **Pine은 정체성에만**(버튼 배경·장식 금지), **Marigold는 서피스로만**(텍스트 색 금지). 새 hex 금지.
- **그림자·그라데이션 전면 금지.** 깊이는 크림 위 스노우 레이어링 + radius로만.
- 전역 `word-break: keep-all` + `overflow-wrap:break-word`. 좌정렬. 숫자 tnum.
- 모서리: 카드 20 / 히어로·구독 카드 clamp(24,5vw,40) / 필 99 / 칩 12. 0~8px 각진 모서리 금지.

## 컴포넌트 치트시트 (클래스)

- **레이아웃**: `.wrap`(max 1160) · `.article`(본문 680) · `.shead`(섹션 헤더) · `.grid2`(모바일1·≥720 2칼럼)
- **네비/브랜드**: `.nav` `.brand` `.brandmark`(북극성 별, Pine) · `.links`(모바일서 텍스트링크 숨김) · `.cta`(구독 필) · `.lang`(KO|EN 필) / 푸터 `footer .b .fs .fk` · `.flinks`
- **공지 바**: `.annbar .annbar-in`(홈만, morning-sky, 링크 밑줄=ember)
- **홈**: `.hero .lead .foot` · `.cover`(스노우 · `.ghost` 잘리는 숫자 · `.chip` · `.ttl` · `.read`) · `.card`(`.chip`/`.eyc`/`h3`/`.k`)
- **아티클**: `.imast`(← 목록/№) · `.ihead`(`.eyebrow` Pine 킥커, `h1`, `.dek`, `.sub`) · `.art`(`.lede`, `p`, `strong` 마리골드 하이라이트) · `.spec`(`.cap`/`.r`/`dt`/`dd`) · `.pq`(좌정렬 풀쿼트) · `.plate`(이미지) · `.band`(flat 차콜 패널) · `.author`(`.av`/`.rl`) · `.pager`(고스트 필)
- **소개**: `.tenets .tenet .tn` · `.members .member .avatar .role .contact .mail-icon` · `.colophon`
- **목록**: `.ilist .ientry .cov`(스노우+`.chip`+`.ghost`) `.txt`
- **구독**: `.subscribe`(마리골드) `.say` `.field`(언더라인 인풋) `.note` `.done` — **`#subscribe`/`#subForm` 및 인라인 JS는 로직 그대로 유지**
- **게이트**: `.gate`(좌정렬, `.cta` 구독 유도)
- **칩·필**: `.chip`(마리골드) · `.cta`(채운 차콜 필) · `.pill`(고스트 필)
- **공통**: `.eyebrow`(라벨) · `.num`(Pretendard 800 숫자) · `.link-underline`(Pine) · `.rise`(진입 애니)

## 새 이슈 추가하기

1. `templates/issue.html`을 복사해 **`issues/<slug>/full.html`**(본문) / **`index.html`**(게이트)로 저장
2. 킥커·제목·데크·본문·글쓴이·이전/다음 링크 채우기
3. **`index.html`**(다음 호 예고)과 **`issues/index.html`**에 카드 한 줄 추가, `№` 부여
4. 로컬 확인 → PR

### 바이브 코딩 프롬프트 (Claude 등에 그대로 붙여넣기)

```
너는 뉴스레터 《북극성과 시행착오 노트》의 새 이슈 페이지를 만든다.
디자인은 이미 정해져 있다 — 새 색/폰트/컴포넌트를 만들지 말고,
기존 assets/style.css의 클래스만 재사용한다.
컨셉: "크림 종이 위에 찍힌 뉴스레터" — 크림(paper) 캔버스,
워드마크(로고)만 Ria Sans, 제목·본문은 Pretendard.
색 규율: 텍스트는 Charcoal 하나 / Pine은 워드마크·링크·킥커에만
/ Marigold는 구독 카드·칩·strong 하이라이트 서피스로만.
그림자·그라데이션 금지, 좌정렬, word-break:keep-all.
참고: design.md(루트) + https://northstar-note.pages.dev/guide/
구조는 issues/issue-13to1/full.html 을 그대로 따른다.

만들 것: issues/<slug>/full.html
- <head>: RiaSans preload(../../assets/fonts/…) + Pretendard CDN
  + ../../assets/style.css + favicon + GA 스니펫 + OG/description 메타
- nav(.brand + .brandmark 별, 링크: 소개/발행목록/.cta 구독)
- .imast  (← 발행 목록 / № 00X)
- .article > .ihead(.eyebrow Pine 킥커, h1 제목, .dek 데크,
  .sub 글쓴이·날짜·읽기시간)
- .art 본문: 첫 문단 .lede, 이후 <p>. 핵심 인용은
  <blockquote class="pq"><p>…</p></blockquote>(좌정렬). 강조는 <strong>.
- (선택) 스펙표 .spec / 강령 .tenets>.tenet(.tn 숫자) /
  일러 .plate / flat 밴드 .band (반드시 <div class="wrap">로 감싼다)
- .author(.av 이니셜, .rl 역할, <p> 소개) + .pager(이전/다음 필)
- footer(.b 슬로건 + .flinks)

원고: [여기에 제목·킥커·본문·글쓴이 붙여넣기]

금지: 새 색·폰트·라이브러리·그라데이션·그림자·이모지,
제목·본문에 Ria Sans(로고 전용), 중앙정렬, 포모/과장/구루 화법.
결론 없으면 없는 대로. 경로는 상대경로. word-break:keep-all.
```

## 기여 흐름 (PR)

1. fork → 브랜치 → 위 방법으로 이슈 추가
2. 로컬 확인 (`python3 -m http.server`)
3. **PR 오픈** → 리뷰 후 머지 → 메인테이너가 Cloudflare Pages로 배포
4. 라이브: **https://northstar-note.pages.dev/**

## 목소리 규칙

- **이렇게**: 직접 해본 1인칭 · 구체적으로(도구·비용·횟수) · 옆자리에서 말하듯 · 담담하되 분명하게
- **이렇게는 않게**: 포모·과장·호언장담 · 두루뭉술한 "AI로 했어요" · 무대 위 선언·구루 화법 · 억지 교훈(없으면 없는 대로)
- 태그라인: **No rush, no hype. We just keep building.**
