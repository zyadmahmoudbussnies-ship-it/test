-- ================================================================
-- منصة أ. أمينة - Database Schema
-- شغّله في: Supabase > SQL Editor > New Query > Run
-- ================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  role         text not null default 'student' check (role in ('admin','student')),
  is_active    boolean not null default true,
  created_at   timestamptz default now()
);

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  url         text not null,
  created_at  timestamptz default now()
);

create table if not exists public.video_assignments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  video_id    uuid not null references public.videos(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique(student_id, video_id)
);

alter table public.profiles          enable row level security;
alter table public.videos            enable row level security;
alter table public.video_assignments enable row level security;

create policy "profiles: self read"        on public.profiles for select using (auth.uid() = id);
create policy "profiles: admin read all"   on public.profiles for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "profiles: admin update"     on public.profiles for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "profiles: service role insert" on public.profiles for insert with check (true);

create policy "videos: admin all"          on public.videos for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "videos: student read assigned" on public.videos for select using (exists (select 1 from public.video_assignments va join public.profiles pr on pr.id = va.student_id where va.video_id = videos.id and va.student_id = auth.uid() and pr.is_active = true));

create policy "assignments: admin all"     on public.video_assignments for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "assignments: student read own" on public.video_assignments for select using (student_id = auth.uid());

-- إنشاء حساب الأدمن
insert into public.profiles (id, username, display_name, role, is_active)
values ('0debfb8a-8449-4033-8add-fad74734e368', 'admin', 'أ. أمينة', 'admin', true)
on conflict (id) do update set role = 'admin';
