create table if not exists public.contabilidad_documentos (
  id_documento uuid primary key default gen_random_uuid(),
  contabilidad_id bigint not null references public.contabilidad(id_contabilidad) on delete cascade,
  club_id bigint not null references public.clubes(id_club) on delete cascade,
  bucket text not null check (bucket in ('facturas', 'nominas')),
  path text not null,
  filename text not null,
  mime text,
  size bigint,
  created_at timestamptz not null default now()
);

create index if not exists contabilidad_documentos_contabilidad_id_idx
  on public.contabilidad_documentos(contabilidad_id);

create index if not exists contabilidad_documentos_club_id_idx
  on public.contabilidad_documentos(club_id);

alter table public.contabilidad_documentos enable row level security;

drop policy if exists contabilidad_documentos_select_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_insert_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_update_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_delete_auth on public.contabilidad_documentos;

create policy contabilidad_documentos_select_auth
  on public.contabilidad_documentos for select
  to authenticated
  using (true);

create policy contabilidad_documentos_insert_auth
  on public.contabilidad_documentos for insert
  to authenticated
  with check (true);

create policy contabilidad_documentos_update_auth
  on public.contabilidad_documentos for update
  to authenticated
  using (true)
  with check (true);

create policy contabilidad_documentos_delete_auth
  on public.contabilidad_documentos for delete
  to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('facturas', 'facturas', false, 1048576, array['application/pdf','image/jpeg','image/png']),
  ('nominas', 'nominas', false, 1048576, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists storage_facturas_nominas_select_auth on storage.objects;
drop policy if exists storage_facturas_nominas_insert_auth on storage.objects;
drop policy if exists storage_facturas_nominas_update_auth on storage.objects;
drop policy if exists storage_facturas_nominas_delete_auth on storage.objects;

create policy storage_facturas_nominas_select_auth
  on storage.objects for select
  to authenticated
  using (bucket_id in ('facturas', 'nominas'));

create policy storage_facturas_nominas_insert_auth
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('facturas', 'nominas'));

create policy storage_facturas_nominas_update_auth
  on storage.objects for update
  to authenticated
  using (bucket_id in ('facturas', 'nominas'))
  with check (bucket_id in ('facturas', 'nominas'));

create policy storage_facturas_nominas_delete_auth
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('facturas', 'nominas'));
