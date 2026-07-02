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

새 이슈를 **바이브 코딩(AI)으로 직접 만들어 PR**할 수 있게 정리했습니다. 핵심 원칙: **새 색·폰트·컴포넌트를 만들지 말고, 이미 있는 `assets/style.css`의 클래스만 재사용**합니다.

라이브 디자인 가이드(스와치·타이포·컴포넌트 실물): **https://northstar-note.pages.dev/guide/**

## 디자인 토큰 (`assets/style.css` `:root`)

| 역할 | 값 |
| --- | --- |
| 캔버스(배경) | `#E7EAE3` |
| 서피스/카드 | `#F1F3ED` |
| 잉크(제목·본문) | `#282B26` |
| 소프트(보조) | `#5F635B` |
| 페인트(라벨·메타) | `#989C90` |
| 헤어라인 | `#D6DACF` |
| **세이지(강조 · 1색)** | `#4E5D51` |
| 다크 패널(커버·밴드) | `#20261F → #151A14` (글자 `#E8EBE2`) |

- 서체: **SUIT Variable** (CDN). 위계는 **크기·굵기·색만**으로. 세리프·모노 혼용 금지.
- 강조는 **세이지 한 색만**. 그라데이션·형광·다색·그림자 남용 금지.
- 전역 `word-break: keep-all`. 얇은 **1px 헤어라인**이 유일한 구조선. 필름 그레인(opacity .045)로 촉감.
- 모서리: 커버 24 / 카드 20 / 아바타 원.

## 컴포넌트 치트시트 (클래스)

- **레이아웃**: `.wrap`(max 1220) · `.article`(본문 720) · `.shead`(섹션 헤더) · `.grid2`(2칼럼)
- **네비/브랜드**: `.nav` `.brand` `.brandmark`(북극성 별) / 푸터 `footer .b .fs .fk`
- **커버**: `.cover`(다크 대형) · `.card .mini`(`.t1/.t2/.t3` 톤) · `.ghost`(edge로 흐르는 숫자) · `.eyc`
- **이슈 본문**: `.imast`(← 목록/№) · `.ihead`(`.eyebrow` 킥커, `h1`, `.dek`, `.sub`) · `.art`(`.lede`, `p`) · `.spec`(`.cap`/`.r`/`dt`/`dd`) · `.pq`(풀쿼트) · `.band`(다크 패널) · `.author`(`.av`/`.rl`) · `.pager`
- **소개**: `.tenets .tenet .tn` · `.members .member .avatar .role .contact .mail-icon` · `.colophon`
- **목록**: `.ilist .ientry .cov .txt`
- **공통**: `.eyebrow`(라벨) · `.num`(thin 숫자) · `.link-underline` · `.rise`(진입 애니)

## 새 이슈 추가하기

1. `templates/issue.html`을 복사해 **`issues/<slug>/index.html`**로 저장
2. 킥커·제목·데크·본문·글쓴이·이전/다음 링크 채우기
3. **`index.html`**(이번 호/지난 호)과 **`issues/index.html`**에 카드 한 줄 추가, `№` 부여
4. 로컬 확인 → PR

### 바이브 코딩 프롬프트 (Claude 등에 그대로 붙여넣기)

```
너는 뉴스레터 《북극성과 시행착오 노트》의 새 이슈 페이지를 만든다.
디자인은 이미 정해져 있다 — 새 색/폰트/컴포넌트를 만들지 말고,
기존 assets/style.css의 클래스만 재사용한다.
톤: 프리미엄·담담·미니멀 (세이지 뉴트럴 배경, SUIT 단일 서체,
강조는 세이지 1색, 넉넉한 여백). 참고: https://northstar-note.pages.dev/guide/
그리고 issues/issue-13to1/index.html 구조를 그대로 따른다.

만들 것: issues/<slug>/index.html
- <head>: SUIT CDN + ../../assets/style.css + ../../assets/favicon.svg
- nav(.brand + .brandmark 별, 링크: 소개/발행목록/№)
- .imast  (← 발행 목록 / № 00X)
- .article > .ihead(.eyebrow 킥커, h1 제목, .dek 데크,
  .sub 글쓴이·날짜·읽기시간)
- .art 본문: 첫 문단 .lede, 이후 <p>. 핵심 인용은
  <blockquote class="pq"><p>…</p></blockquote>. 강조는 <strong>.
- (선택) 스펙표 .spec / 강령 .tenets>.tenet(.tn 숫자) /
  다크 다이어그램 .band (반드시 <div class="wrap">로 감싼다)
- .author(.av 이니셜, .rl 역할, <p> 소개) + .pager(이전/다음)
- footer(.b 슬로건)

원고: [여기에 제목·킥커·본문·글쓴이 붙여넣기]

금지: 새 색·폰트·라이브러리·그라데이션·이모지, 포모/과장/구루 화법.
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
