-- SLOP analytics, attribution, campaigns, video sessions, referrals, rewards
-- Apply after 001_slop_schema.sql. All metrics must come from these records.

create table if not exists public.analytics_sessions (
  id text primary key,
  anonymous_id text not null,
  user_id uuid references public.profiles (id) on delete set null,
  first_touch_source text not null default 'unknown',
  first_touch_medium text,
  first_touch_campaign text,
  first_touch_content text,
  first_touch_term text,
  first_touch_referrer text,
  first_touch_landing text,
  last_touch_source text not null default 'unknown',
  last_touch_medium text,
  last_touch_campaign text,
  last_touch_content text,
  last_touch_term text,
  last_touch_referrer text,
  last_touch_landing text,
  campaign_id uuid,
  tracking_link_id uuid,
  referral_code text,
  consent_analytics boolean not null default true,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  page_count int not null default 0,
  engaged boolean not null default false
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  session_id text references public.analytics_sessions (id) on delete set null,
  anonymous_id text,
  user_id uuid references public.profiles (id) on delete set null,
  path text,
  referrer text,
  source text,
  medium text,
  campaign text,
  content_id text,
  drama_id text,
  episode_id text,
  playback_session_id text,
  properties jsonb not null default '{}'::jsonb,
  idempotency_key text unique
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at desc);
create index if not exists analytics_events_user_time_idx
  on public.analytics_events (user_id, occurred_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  platform text not null default 'other',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  active boolean not null default true,
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  code text not null unique,
  label text not null,
  destination_path text not null default '/',
  active boolean not null default true,
  click_count bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.playback_sessions (
  id text primary key,
  episode_id text not null,
  drama_id text,
  session_id text,
  user_id uuid references public.profiles (id) on delete set null,
  anonymous_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms int not null default 0,
  watched_ms int not null default 0,
  max_pct numeric(5,2) not null default 0,
  completed_25 boolean not null default false,
  completed_50 boolean not null default false,
  completed_75 boolean not null default false,
  completed_100 boolean not null default false,
  abandoned boolean not null default false,
  unique_start_counted boolean not null default true
);

create index if not exists playback_episode_idx on public.playback_sessions (episode_id, started_at desc);

create table if not exists public.ad_revenue_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  occurred_on date not null,
  impressions bigint not null default 0,
  requests bigint not null default 0,
  completions bigint not null default 0,
  clicks bigint not null default 0,
  revenue_cents bigint not null default 0,
  is_estimate boolean not null default false,
  drama_id text,
  episode_id text,
  campaign_id uuid,
  imported_at timestamptz not null default now(),
  unique (provider, occurred_on, drama_id, episode_id, campaign_id)
);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  stripe_event_id text unique,
  amount_cents int,
  currency text default 'usd',
  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  session_id text,
  anonymous_id text,
  landing_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_relationships (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  status text not null default 'registered'
    check (status in ('registered', 'qualified_free', 'premium', 'rejected', 'suspicious')),
  email_verified boolean not null default false,
  watch_milestone_met boolean not null default false,
  premium_qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referred_user_id)
);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  trigger_type text not null check (trigger_type in ('qualified_free_count', 'premium_referral_count')),
  threshold int not null,
  reward_type text not null,
  reward_value jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rule_id uuid references public.reward_rules (id),
  status text not null default 'pending'
    check (status in ('pending', 'earned', 'redeemed', 'revoked', 'rejected')),
  idempotency_key text not null unique,
  reason text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);

create table if not exists public.platform_analytics_settings (
  id int primary key default 1 check (id = 1),
  attribution_window_days int not null default 30,
  min_watch_minutes_for_qualified int not null default 10,
  require_email_verification boolean not null default true,
  referral_enabled boolean not null default true,
  analytics_consent_required boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_analytics_settings (id) values (1) on conflict do nothing;

insert into public.reward_rules (key, label, trigger_type, threshold, reward_type, reward_value, sort_order)
values
  ('badge_3', 'Exclusive profile badge', 'qualified_free_count', 3, 'profile_badge', '{"badge":"connector"}', 1),
  ('adfree_7', '7 days ad-free', 'qualified_free_count', 5, 'ad_free_days', '{"days":7}', 2),
  ('adfree_30', '30 days ad-free', 'qualified_free_count', 10, 'ad_free_days', '{"days":30}', 3),
  ('premium_30', '30 days Premium after referred paid month', 'premium_referral_count', 1, 'premium_days', '{"days":30,"requires_referred_paid_days":30}', 4)
on conflict (key) do nothing;

alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.campaigns enable row level security;
alter table public.tracking_links enable row level security;
alter table public.playback_sessions enable row level security;
alter table public.ad_revenue_records enable row level security;
alter table public.subscription_events enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.referral_relationships enable row level security;
alter table public.reward_rules enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.platform_analytics_settings enable row level security;

-- Public read of active reward rules; writes via service role / admin
create policy "Anyone read active reward rules"
  on public.reward_rules for select using (active = true or public.is_admin());

create policy "Users read own referral code"
  on public.referral_codes for select using (auth.uid() = user_id or public.is_admin());

create policy "Users read own referral relationships as referrer"
  on public.referral_relationships for select
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id or public.is_admin());

create policy "Users read own rewards"
  on public.reward_transactions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Admins manage analytics tables"
  on public.campaigns for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage tracking links"
  on public.tracking_links for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins read analytics events"
  on public.analytics_events for select using (public.is_admin());

create policy "Admins read sessions"
  on public.analytics_sessions for select using (public.is_admin());

create policy "Admins read playback"
  on public.playback_sessions for select using (public.is_admin());

create policy "Admins manage ad revenue"
  on public.ad_revenue_records for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins read subscription events"
  on public.subscription_events for select using (public.is_admin());

create policy "Anyone read analytics settings"
  on public.platform_analytics_settings for select using (true);

create policy "Admins update analytics settings"
  on public.platform_analytics_settings for update using (public.is_admin());
