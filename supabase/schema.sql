-- 핑캠퍼스 서버 테이블 (CLAUDE.md: 이 세 테이블만 둡니다)
-- Supabase SQL Editor에서 한 번 실행하세요. 접근은 서버 라우트의 service role 키로만 합니다.

create table if not exists devices (
  id uuid primary key,                       -- 익명 기기 ID (이름·학번·이메일 없음)
  department_code text,
  grade smallint check (grade between 1 and 4),
  urgent_enabled boolean not null default true,  -- 알림 C 받기
  push_subscription jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists devices_dept_idx on devices (department_code, grade);

create table if not exists shared_events (
  id uuid primary key default gen_random_uuid(),
  department_code text not null,             -- '*' = 학교 홈페이지 공용 피드 (FR-9)
  scope text not null check (scope in ('grade', 'department')),
  grades smallint[] not null default '{}',
  title text not null,
  date date not null,
  start_time text,
  end_time text,
  location text,
  category text not null,
  apply_url text,
  origin text not null default 'student' check (origin in ('student', 'homepage')),
  is_urgent boolean not null default false,
  registrant_device_ids uuid[] not null default '{}',  -- 화면에는 인원수만
  report_device_ids uuid[] not null default '{}',
  hidden boolean not null default false,
  urgent_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shared_events_dept_date_idx on shared_events (department_code, date);

create table if not exists scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  key text not null,                         -- 기기 안에서 알림을 구분하는 키
  kind text not null check (kind in ('beforeEvent', 'atGoHome', 'deptUrgent')),
  notify_at timestamptz not null,
  expires_at timestamptz not null,           -- 행사 시작 시각. 지나면 늦었어도 보내지 않음
  title text not null,
  body text not null,
  url text not null default '/',
  shared_event_ids uuid[] not null default '{}',
  sent_at timestamptz,
  cancelled boolean not null default false,
  unique (device_id, key)
);
-- 이전 버전 스키마에서 올릴 때
alter table scheduled_notifications add column if not exists expires_at timestamptz not null default now();

create index if not exists scheduled_due_idx on scheduled_notifications (notify_at) where sent_at is null and not cancelled;

-- 클라이언트(anon) 접근을 막습니다. service role은 RLS를 우회합니다.
alter table devices enable row level security;
alter table shared_events enable row level security;
alter table scheduled_notifications enable row level security;
