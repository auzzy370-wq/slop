-- SLOP initial schema + RLS
-- Apply with Supabase CLI or SQL editor. Admin role must be provisioned
-- out-of-band (service role / secure script), never by client registration.

create extension if not exists "pgcrypto";

create type public.account_status as enum ('active', 'suspended', 'banned', 'pending_deletion');
create type public.user_role as enum ('user', 'admin');
create type public.publication_status as enum ('draft', 'scheduled', 'published', 'unpublished');
create type public.subscription_status as enum ('none', 'active', 'canceled', 'past_due', 'expired', 'trialing');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.moderation_status as enum ('visible', 'hidden', 'removed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  preferences jsonb not null default '{"autoplay":true,"defaultMuted":true}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default '✨',
  image_url text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  video_url text not null,
  thumbnail_url text not null,
  duration_seconds int not null default 0,
  aspect_ratio text not null default '9:16',
  tags text[] not null default '{}',
  status public.publication_status not null default 'draft',
  featured boolean not null default false,
  pinned boolean not null default false,
  source_attribution text not null default '',
  licensing_notes text not null default '',
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  save_count bigint not null default 0,
  comments_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  scheduled_at timestamptz,
  created_by uuid references public.profiles (id)
);

create table public.video_categories (
  video_id uuid not null references public.videos (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (video_id, category_id)
);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table public.saved_videos (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  moderation_status public.moderation_status not null default 'visible',
  created_at timestamptz not null default now()
);

create table public.engagement_events (
  id bigserial primary key,
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  event_type text not null,
  watch_ms int,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status public.subscription_status not null default 'none',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  content_type text not null check (content_type in ('video', 'comment')),
  content_id uuid not null,
  reason text not null,
  details text not null default '',
  status public.report_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  target_type text not null,
  target_id text not null,
  action_type text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'SLOP',
  tagline text not null default 'AI brainrot, on tap.',
  maintenance_mode boolean not null default false,
  registration_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  ads_enabled boolean not null default true,
  ad_placement_every int not null default 4,
  premium_monthly_price_cents int not null default 799,
  featured_video_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict do nothing;

create index videos_status_published_at_idx on public.videos (status, published_at desc);
create index videos_view_count_idx on public.videos (view_count desc);
create index comments_video_id_idx on public.comments (video_id, created_at desc);
create index engagement_video_created_idx on public.engagement_events (video_id, created_at desc);
create index reports_status_idx on public.reports (status, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid() and s.status in ('active', 'trialing')
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.videos enable row level security;
alter table public.video_categories enable row level security;
alter table public.likes enable row level security;
alter table public.saved_videos enable row level security;
alter table public.comments enable row level security;
alter table public.engagement_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- Profiles
create policy "Public can read basic profiles"
  on public.profiles for select
  using (status = 'active');

create policy "Users update own profile fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "Admins manage profiles"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- Categories / videos: public read published only
create policy "Anyone read active categories"
  on public.categories for select
  using (active = true or public.is_admin());

create policy "Admins manage categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone read published videos"
  on public.videos for select
  using (status = 'published' or public.is_admin());

create policy "Admins manage videos"
  on public.videos for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone read video categories for published"
  on public.video_categories for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.videos v
      where v.id = video_id and v.status = 'published'
    )
  );

create policy "Admins manage video categories"
  on public.video_categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- Social
create policy "Users manage own likes"
  on public.likes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own saves"
  on public.saved_videos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Read visible comments"
  on public.comments for select
  using (moderation_status = 'visible' or auth.uid() = user_id or public.is_admin());

create policy "Users insert comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "Users delete own comments"
  on public.comments for delete
  using (auth.uid() = user_id or public.is_admin());

create policy "Users insert engagement"
  on public.engagement_events for insert
  with check (user_id is null or auth.uid() = user_id);

create policy "Admins read engagement"
  on public.engagement_events for select
  using (public.is_admin());

-- Subscriptions: users read own; writes via service role / webhooks only
create policy "Users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

-- Reports
create policy "Users create reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

create policy "Users read own reports"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

create policy "Admins update reports"
  on public.reports for update
  using (public.is_admin());

create policy "Admins read moderation"
  on public.moderation_actions for select
  using (public.is_admin());

create policy "Admins insert moderation"
  on public.moderation_actions for insert
  with check (public.is_admin() and admin_id = auth.uid());

create policy "Admins read audit logs"
  on public.audit_logs for select
  using (public.is_admin());

create policy "Anyone read settings"
  on public.platform_settings for select
  using (true);

create policy "Admins update settings"
  on public.platform_settings for update
  using (public.is_admin());
