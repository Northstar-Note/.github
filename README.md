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
