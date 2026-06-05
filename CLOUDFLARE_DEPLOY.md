# ☁️ Cloudflare Pages 배포 가이드

온라인 담타를 **Cloudflare Pages + Workers + Durable Objects**로 마이그레이션하는 방법입니다.

---

## 1단계: Cloudflare 계정 준비 (무료)

1. https://dash.cloudflare.com/sign-up 에서 계정 생성 (이메일만 필요)
2. 로그인 후 왼쪽 메뉴에서 **Workers & Pages** 클릭

---

## 2단계: GitHub 저장소 연결

### 2-1. 저장소 확인
이 코드는 이미 GitHub `flffkaos-pixel/damta`에 푸시되어 있습니다.

### 2-2. Cloudflare Pages 프로젝트 생성
1. **Workers & Pages** → **Create application** → **Pages** 탭 → **Connect to Git**
2. **GitHub** 선택 → Cloudflare 인증 → 저장소 `flffkaos-pixel/damta` 선택
3. **Begin setup** 클릭

### 2-3. 빌드 설정
| 항목 | 값 |
|---|---|
| **Project name** | `onlinedamta` (URL: `onlinedamta.pages.dev`) |
| **Production branch** | `main` |
| **Build command** | (비워두기) |
| **Build output directory** | `public` |

**Save and Deploy** 클릭 → 첫 빌드 실패 예상 (Durable Object 바인딩 미설정)

---

## 3단계: Durable Object 바인딩 설정 (필수!)

빌드 실패 후 또는 빌드 완료 후:

1. Pages 프로젝트 → **Settings** 탭 → **Functions** 섹션
2. **Durable Object bindings** → **Add binding** 클릭
3. 입력:
   - **Variable name**: `CHAT_ROOM`
   - **Durable Object class name**: `ChatRoom`
4. **Save** 클릭

5. **Deployments** 탭 → 최신 배포의 **...** 메뉴 → **Retry deployment**

> `wrangler.toml`에 이미 바인딩이 정의되어 있어 자동 감지될 수도 있습니다.
> 그래도 안 되면 위 수동 설정 필요.

---

## 4단계: 도메인 설정 (선택)

### 옵션 A: 무료 `*.pages.dev` 서브도메인
- 자동 제공: `onlinedamta.pages.dev`
- 추가 작업 없음

### 옵션 B: 커스텀 도메인 (Cloudflare Registrar)
1. Cloudflare에서 도메인 구매 (`.xyz` ~$1/년)
2. Pages 프로젝트 → **Custom domains** → **Set up a custom domain**
3. 도메인 입력 → Cloudflare가 DNS 자동 설정

---

## 5단계: Render.com 정리 (선택)

Cloudflare에서 안정적으로 동작하면:

1. https://dashboard.render.com → `damta-clone` 서비스 → **Settings** → **Delete Service**
2. `render.yaml` 파일도 GitHub에서 제거 가능

---

## 비용

| 항목 | 비용 |
|---|---|
| **Cloudflare Pages** | 무료 (무제한 정적 호스팅) |
| **Cloudflare Workers** | 무료 (100,000 요청/일) |
| **Durable Objects** | 무료 (1GB 저장, 수백만 연산/월) |
| **WebSocket** | 무료 (Workers 요청에 포함) |
| **SSL/HTTPS** | 무료 (자동) |
| **DDoS 방어** | 무료 (Cloudflare 기본) |
| **합계** | **$0/월** |

> Hobby 프로젝트 수준에서는 무료 한도 절대 초과 안 함.

---

## 트러블슈팅

### "Could not load binding: CHAT_ROOM" 오류
→ 3단계의 Durable Object 바인딩 수동 설정 필요

### WebSocket 연결 안 됨
→ 브라우저 콘솔(F12)에서 `wss://onlinedamta.pages.dev/api/ws` 확인
→ Cloudflare Pages는 WebSocket 지원 (2023년부터)

### 채팅은 되는데 온라인 카운트가 0
→ Durable Object의 `broadcastUserCount`가 첫 연결 시점에 호출됨
→ 페이지 새로고침 시 정상화

### 슬립 없음 (Render.com과 비교)
✅ Cloudflare Pages는 슬립 없음. 항상 24/7 동작.

---

## 아키텍처

```
브라우저 (사용자)
   ↓ WebSocket (wss://)
Cloudflare Pages Edge
   ↓ /api/ws
Pages Function (functions/api/ws.js)
   ↓ context.env.CHAT_ROOM
Durable Object (ChatRoom)
   ├── sessions: Map<sessionId, WebSocket>
   ├── nicknameMap: Map<sessionId, string>
   └── totalVapes: number (SQLite 영구 저장)
```

전 세계 Cloudflare 엣지에서 실행되며, Durable Object가 단일 인스턴스로 모든 클라이언트 연결을 중계합니다.
