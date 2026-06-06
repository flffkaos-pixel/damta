# ☁️ Cloudflare Pages 배포 가이드 (대시보드 설정 버전)

온라인 담타를 **Cloudflare Pages + Workers + Durable Objects**로 마이그레이션하는 방법입니다.

> ⚠️ **중요**: wrangler.toml 검증 오류로 인해, 모든 설정은 Cloudflare 대시보드에서 수동으로 합니다.

---

## 1단계: Cloudflare 가입 (무료)

https://dash.cloudflare.com/sign-up → 이메일만 필요

---

## 2단계: Pages 프로젝트 생성

1. **Workers & Pages** → **Create application** → **Pages** 탭 → **Connect to Git**
2. **GitHub** 선택 → 저장소 `flffkaos-pixel/damta` 선택
3. **Begin setup** 클릭

### 빌드 설정

| 항목 | 값 |
|---|---|
| **Project name** | `onlinedamta` (URL: `onlinedamta.pages.dev`) |
| **Production branch** | `main` |
| **Framework preset** | **None** |
| **Build command** | **(비워두기)** |
| **Build output directory** | `public` |

4. **Save and Deploy** 클릭

> 첫 빌드는 실패할 수 있습니다 (Durable Object 바인딩 미설정). 정상입니다.

---

## 3단계: Durable Object 바인딩 설정 (필수!)

### 3-1. DO 바인딩 추가
1. Pages 프로젝트 → **Settings** 탭
2. **Functions** 섹션 → **Durable Object bindings**
3. **Add binding** 클릭
4. 입력:
   - **Variable name**: `CHAT_ROOM`
   - **Durable Object class name**: `ChatRoom`
5. **Save** 클릭

### 3-2. DO 클래스 자동 생성 확인
- 첫 배포 시 Durable Object 클래스는 자동으로 생성됩니다
- 별도 migration 작업 불필요 (Pages lazy creation 지원)

### 3-3. 재배포
1. **Deployments** 탭
2. 최신 실패한 배포의 **...** 메뉴 → **Retry deployment**

---

## 4단계: 도메인 설정 (선택)

### 옵션 A: 무료 `*.pages.dev` 서브도메인
- 자동 제공: `onlinedamta.pages.dev`
- 추가 작업 없음

### 옵션 B: 커스텀 도메인
1. Cloudflare Registrar에서 도메인 구매 (`.xyz` ~$1/년)
2. Pages 프로젝트 → **Custom domains** → **Set up a custom domain**
3. 도메인 입력 → Cloudflare가 DNS 자동 설정

---

## 5단계: Render.com 정리 (선택)

Cloudflare에서 안정적으로 동작하면:

1. https://dashboard.render.com → `damta-clone` 서비스 → **Settings** → **Delete Service**

---

## 비용

| 항목 | 비용 |
|---|---|
| Cloudflare Pages | 무료 |
| Cloudflare Workers | 무료 (100K req/일) |
| Durable Objects | 무료 (1GB 저장) |
| SSL/HTTPS | 무료 |
| DDoS 방어 | 무료 |
| **합계** | **$0/월** |

---

## 트러블슈팅

### 빌드 실패: "Failed to read wrangler.toml"
→ wrangler.toml이 저장소에 없어야 합니다. 이번에 제거했습니다.

### "Could not load binding: CHAT_ROOM"
→ 3단계의 DO 바인딩 수동 설정 필요

### WebSocket 연결 안 됨
→ 브라우저 콘솔(F12) 확인
→ `/api/ws` 엔드포인트가 Pages Function으로 배포되어야 함

### "No deployment available"
→ Cloudflare가 새 커밋 감지 안 함
→ **Settings → Builds** → **Retry deployment** 또는 GitHub 재연결

---

## 아키텍처

```
브라우저 → Cloudflare Pages Edge → /api/ws (Pages Function)
                                       ↓
                              Durable Object (ChatRoom)
                              ├── WebSocket 중계
                              ├── 닉네임 관리
                              └── 일일 vape 통계 (SQLite)
```

Cloudflare 글로벌 엣지에서 실행, Durable Object가 모든 클라이언트 연결 중계.
