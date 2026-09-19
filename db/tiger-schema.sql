create extension if not exists pgcrypto;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null default gen_random_uuid(),
  active_plan_id uuid,
  state text not null default 'created',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists device_state (
  device_id text primary key,
  device_type text not null check (device_type in ('arm','camera','vision')),
  online boolean not null default false,
  last_seen timestamptz not null default now(),
  session_id uuid references sessions(id) on delete set null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists arm_telemetry (
  time timestamptz not null default now(),
  device_id text not null,
  session_id uuid,
  mode text not null,
  armed boolean not null,
  pca_ready boolean not null,
  estop boolean not null,
  joint_0 double precision,
  joint_1 double precision,
  joint_2 double precision,
  joint_3 double precision,
  joint_4 double precision,
  plunger_left double precision,
  plunger_right double precision,
  target_0 double precision,
  target_1 double precision,
  target_2 double precision,
  target_3 double precision,
  target_4 double precision,
  wifi_rssi integer,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists arm_telemetry_device_time_idx
  on arm_telemetry(device_id, time desc);

create table if not exists camera_telemetry (
  time timestamptz not null default now(),
  device_id text not null,
  session_id uuid,
  frame_seq bigint not null,
  capture_ms integer,
  upload_ms integer,
  frame_age_ms integer,
  wifi_rssi integer,
  image_url text,
  width integer,
  height integer,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists camera_telemetry_device_time_idx
  on camera_telemetry(device_id, time desc);

create table if not exists head_tracking (
  time timestamptz not null default now(),
  session_id uuid,
  device_id text not null default 'vision-01',
  seq bigint not null,
  tracking boolean not null,
  confidence double precision not null default 0,
  x double precision,
  y double precision,
  z double precision,
  roll double precision,
  pitch double precision,
  yaw double precision,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists arm_commands (
  id uuid primary key default gen_random_uuid(),
  device_id text not null default 'arm-01',
  session_id uuid,
  command text not null,
  args jsonb not null default '{}'::jsonb,
  state text not null default 'pending'
    check (state in ('pending','delivered','done','failed','cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  completed_at timestamptz
);

create index if not exists arm_commands_pending_idx
  on arm_commands(device_id, state, created_at);

create table if not exists robot_events (
  time timestamptz not null default now(),
  session_id uuid,
  device_id text,
  event_type text not null,
  severity text not null default 'info',
  message text,
  payload jsonb not null default '{}'::jsonb
);


-- WebRTC signaling state for the phone rear camera.
-- Media itself remains peer-to-peer; this table only carries SDP offer/answer blobs.
create table if not exists camera_signaling (
  session_key text primary key,
  offer jsonb,
  answer jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists camera_signaling_updated_idx
  on camera_signaling(updated_at desc);
