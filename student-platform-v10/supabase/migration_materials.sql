-- ================================================================
-- إضافة ميزة "الملفات" (PDF / Word) لمشروع موجود بالفعل
-- شغّله في: Supabase > SQL Editor > New Query > Run
-- (آمن إنك تشغّله حتى لو المشروع فيه بيانات بالفعل — مفيش حاجة هتتمسح)
-- ================================================================

create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  file_url    text not null,
  file_type   text,
  created_at  timestamptz default now()
);

create table if not exists public.material_assignments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  material_id   uuid not null references public.materials(id) on delete cascade,
  assigned_at   timestamptz default now(),
  unique(student_id, material_id)
);

alter table public.materials            enable row level security;
alter table public.material_assignments enable row level security;

drop policy if exists "materials: admin all" on public.materials;
create policy "materials: admin all" on public.materials for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "materials: student read assigned" on public.materials;
create policy "materials: student read assigned" on public.materials for select using (exists (select 1 from public.material_assignments ma join public.profiles pr on pr.id = ma.student_id where ma.material_id = materials.id and ma.student_id = auth.uid() and pr.is_active = true));

drop policy if exists "material_assignments: admin all" on public.material_assignments;
create policy "material_assignments: admin all" on public.material_assignments for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "material_assignments: student read own" on public.material_assignments;
create policy "material_assignments: student read own" on public.material_assignments for select using (student_id = auth.uid());

-- Storage bucket لرفع ملفات PDF/Word (public عشان الرابط يفتح مباشرة للطالب المعيّن ليه)
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do nothing;

drop policy if exists "materials bucket: admin upload" on storage.objects;
create policy "materials bucket: admin upload" on storage.objects for insert
  with check (bucket_id = 'materials' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "materials bucket: admin delete" on storage.objects;
create policy "materials bucket: admin delete" on storage.objects for delete
  using (bucket_id = 'materials' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "materials bucket: public read" on storage.objects;
create policy "materials bucket: public read" on storage.objects for select
  using (bucket_id = 'materials');
