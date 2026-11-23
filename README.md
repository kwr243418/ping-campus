# 핑캠퍼스 (Ping Campus)

카카오톡 공지방·학교 홈페이지·에브리타임·포스터에 흩어진 교내 행사 공지를 붙여넣거나 찍으면 **날짜·시간·장소 카드**로 정리하고, 알맞은 때에 알려 주는 모바일 웹앱(PWA)입니다.

- **알림 A** 행사 당일 1시간 전 (모든 대상 행사)
- **알림 B** 귀가 시간 = 그날 마지막 수업 종료 시각. 그 뒤에 행사가 있으면 귀가 시간에 1건으로 묶어 알림
- **알림 C** 같은 학과·학년 학생이 등록한 촉박한 당일 행사(시작 6시간 이내)를 즉시 알림

기획 문서: [`docs/PRD.md`](docs/PRD.md) · 개발 규칙: [`CLAUDE.md`](CLAUDE.md) · 프롬프트 기록: [`docs/PROMPTS.md`](docs/PROMPTS.md)

## 다른 컴퓨터에서 실행하기

Vercel·Supabase 없이 내 컴퓨터에서 바로 데모를 돌릴 수 있습니다.

### 1. 준비물

- **Node.js 24** (20 이상이면 대부분 동작, CI는 24 사용) — https://nodejs.org 에서 LTS 설치 후 `node -v`로 확인
- **Git** — `git --version`으로 확인 (없으면 GitHub에서 **Code → Download ZIP**으로 받아도 됩니다)
- **Chrome** 권장 (푸시 알림·PWA 확인용)

### 2. 받기 · 설치 · 실행

```bash
git clone https://github.com/kwr243418/ping-campus.git
cd ping-campus
npm install
cp .env.example .env.local   # Windows(PowerShell): copy .env.example .env.local
npm run dev                  # http://localhost:3000
```

브라우저에서 http://localhost:3000 을 열면 온보딩부터 시작합니다. 휴대폰 화면으로 보려면 Chrome 개발자도구(macOS ⌥⌘I / Windows F12)에서 기기 모드(⇧⌘M / Ctrl+Shift+M)를 켜세요.

### 3. 키 없이 되는 것과 대체 방식

`.env.local` 값을 비워 둬도 데모가 돌아갑니다.

| 없을 때 | 대신 |
|---|---|
| `ANTHROPIC_API_KEY` | 정규식 대체 파서로 공지 정리 (포스터 이미지·시간표 캡처 인식은 텍스트로 붙여넣으라는 안내) |
| `SUPABASE_*` | 서버 메모리 저장소 (개발 서버를 껐다 켜면 공유 행사·알림 예약 초기화) |
| VAPID 키 | 앱 안 알림센터(🔔)와 브라우저 알림으로만 표시 |
| 외부 스케줄러 | 개발 서버가 1분마다 같은 발송 로직을 직접 실행 (`instrumentation-node.ts`) |

데모 도구(설정 → 테스트 모드의 '현재 시각 바꾸기', '가상 학과 친구가 등록하기')는 개발 서버에서 기본으로 켜져 있습니다.

### 4. (선택) 키 넣기

`.env.local`은 GitHub에 올라가지 않으므로 컴퓨터마다 따로 만듭니다. 바꾼 뒤에는 개발 서버를 다시 켜세요.

- **실제 푸시 알림**: 아래 명령으로 만든 두 값을 넣고, 앱의 설정 → "푸시 알림 켜기" → "지금 알림 보내기"
  ```bash
  npx web-push generate-vapid-keys
  ```
  ```
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key>
  VAPID_PRIVATE_KEY=<Private Key>
  ```
- **AI 공지 정리·이미지 인식**: `ANTHROPIC_API_KEY=<내 키>`

### 5. 휴대폰에서 같이 보기 (선택)

컴퓨터와 휴대폰이 같은 Wi-Fi에 있으면 휴대폰 브라우저에서 `http://<컴퓨터 IP>:3000` 으로 열 수 있습니다(맥: 시스템 설정 → Wi-Fi → 세부사항, Windows: `ipconfig`). 단, 푸시 알림과 앱 설치(PWA)는 https 또는 localhost에서만 되므로 휴대폰에서는 화면 확인용으로 쓰세요.

### 6. 잘 안 될 때

| 증상 | 해결 |
|---|---|
| `npm install` 실패 | `node -v`가 20 이상인지 확인 → `node_modules`를 지우고 다시 `npm install` |
| 3000번 포트를 이미 사용 중 | `npm run dev -- -p 3001` 후 http://localhost:3001 |
| 화면이 이상하거나 예전 데이터가 보임 | 설정 맨 아래 **데모 데이터로 초기화**, 또는 개발자도구 → Application → Local Storage 지우기 |
| 알림 C가 안 옴 | 두 창(일반 + 시크릿)의 학과·학년이 같은지, 행사가 **오늘·6시간 이내**인지 확인 |
| 푸시가 안 뜸 | VAPID 키를 넣고 서버를 다시 켰는지, 브라우저·OS 알림 권한이 허용인지 확인 (없어도 🔔 알림센터에는 쌓임) |

## 시연 순서 (UT 과업과 같은 흐름)

1. **온보딩** 학과·학년 → 시간표(예시 불러오기 또는 격자 입력) → 관심 분야 → 알림
2. **공지 추가** `+ 공지 추가` → 붙여넣기 → 정리하기 → 확인 화면(누락 '확인 필요', 알림 미리보기) → 저장
3. **귀가 시간 알림** 설정 → 테스트 모드 → 현재 시각을 수업 끝나는 시각으로 바꾸기 → 🔔 알림센터에서 "수업 끝!" 확인
4. **휴강** 시간표 → 날짜별 예외 → 휴강 추가 → 귀가 시간이 바뀌는 것 확인
5. **학과 공유 C** (둘 중 하나)
   - 일반 창 + 시크릿 창을 같은 학과·학년으로 설정 → 한쪽에서 오늘 몇 시간 뒤 행사를 등록(공유 스위치 자동 켜짐) → 다른 쪽 홈에 ⚡ 배너·알림센터
   - 기기 1대: 설정 → 테스트 모드 → **가상 학과 친구가 등록하기**

## 명령어

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run lint
npm run test       # Vitest (FR-7 표 10개, FR-11 표 12개 포함)
npm run test:e2e   # Playwright (처음 한 번 npx playwright install chromium, 또는 PW_CHANNEL=chrome)
```

## 배포 (Vercel)

1. GitHub 저장소를 만들고 푸시한 뒤 Vercel에서 가져오기
2. **Supabase** 프로젝트를 만들고 SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql) 실행 (예전 스키마를 이미 만들었다면 다시 실행하면 `expires_at` 열이 추가됩니다)
3. Vercel 환경변수: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, (선택) `SCHOOL_NOTICE_URL`. 데모 도구는 배포에서 기본으로 꺼지며, 배포한 앱으로 시연할 때만 `ENABLE_DEMO_TOOLS=true`(켜면 가상 친구 행사가 같은 학과·학년 실제 사용자에게도 보임)
4. **10분 크론**: Vercel Hobby 플랜의 Cron은 하루 1회까지라서 GitHub Actions로 호출합니다. 저장소 Settings → Secrets → Actions에 `APP_URL`(배포 주소), `CRON_SECRET`을 넣으면 [`.github/workflows/cron-notify.yml`](.github/workflows/cron-notify.yml)(10분마다)과 [`cron-notices.yml`](.github/workflows/cron-notices.yml)(07:00·13:00)이 동작합니다. GitHub 스케줄은 늦거나 건너뛸 수 있어, 늦게 돈 실행에서도 **행사 시작 전이면 보내고 시작 후면 보내지 않습니다**.
5. iPhone은 Safari에서 **홈 화면에 추가**한 뒤 앱으로 열어야 푸시를 받을 수 있습니다(iOS 16.4+).

## 구조

```
app/(tabs)/        홈(S02)·주간(S06)·내 일정(S07)·설정(S09)
app/onboarding     S01      app/add       S03→S04      app/event/[id]   S05
app/timetable      S08      app/notifications S10
app/api/           extract, extract-timetable, device, push/subscribe, notify/schedule, notify/test,
                   share(+report, demo-friend), cron/notify, cron/notices
lib/schedule.ts    귀가 시간·알림 A·B 판단        lib/share.ts   촉박함·범위·수신자·합치기·신고
lib/extract/       프롬프트·zod 스키마·마스킹·대체 파서·시간표 인식
lib/server/        저장소(Supabase/메모리)·푸시·크론·공유·홈페이지 수집 (서버 전용)
public/sw.js       서비스 워커 (푸시 표시, 오프라인 캐시)
```

## 개인정보

- 로그인 없음. 기기를 구분하는 값은 첫 실행 때 만든 **익명 기기 ID**뿐입니다.
- 시간표·공유하지 않은 행사·원문은 기기(localStorage)에만 저장합니다. 알림 예약은 기기에서 계산해 발송에 필요한 문구와 시각만 서버에 올립니다.
- AI로 보내기 전에 전화번호·이메일·학번·카톡 발신자 이름을 `[마스킹]` 처리합니다. 업로드 이미지는 저장하지 않습니다.
- 공유는 카드 필드(제목·날짜·시간·장소·분야·신청 링크)만 올리고, 화면에는 등록 인원수만 보여 줍니다.
- 학교 홈페이지 수집은 robots.txt를 따르고, `PingCampusBot` User-Agent로 하루 2회(1시간 이상 간격), 한 번에 글 3건까지만 엽니다.

## 수용한 위험과 한계

- 인증이 없어 다른 학과를 골라 공유하거나 장난 행사를 올릴 수 있습니다. 신고 2건 숨김·기기당 하루 공유 5건·학과당 하루 C 3건·등록 인원 표시로 줄입니다. 신고는 서버에 등록된 기기가 자기 피드에 보이는 행사에만 할 수 있지만, 기기 ID를 여러 개 만들면 여전히 숨길 수 있습니다.
- 공유한 행사를 내 기기에서 고치거나 지워도 이미 공유된 정보는 바뀌지 않습니다.
- `config/departments.ts`는 예시 학과 목록입니다. 학교 홈페이지 기준으로 바꿔야 합니다.
- AI 추출 정확도(샘플 10건 90%)는 `ANTHROPIC_API_KEY`를 넣고 측정해야 합니다.
