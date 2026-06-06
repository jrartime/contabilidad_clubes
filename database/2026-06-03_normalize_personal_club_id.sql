-- Normalizacion inicial: public.personal debe pertenecer a un club.
--
-- Objetivo:
-- 1. Anadir public.personal.club_id con convencion snake_case.
-- 2. Rellenar club_id usando el uso historico en public.contabilidad.
-- 3. Crear indice y clave foranea hacia public.clubes(id_club).
-- 4. Dejar la columna como NOT NULL solo si todas las filas se han podido asignar.
--
-- Ejecutar en Supabase SQL Editor sobre el proyecto nuevo.

begin;

alter table public.personal
  add column if not exists club_id bigint;

with uso_por_club as (
  select
    c.personal_id as id_personal,
    c.club_id,
    count(*) as usos,
    row_number() over (
      partition by c.personal_id
      order by count(*) desc, c.club_id
    ) as rn
  from public.contabilidad c
  where c.personal_id is not null
    and c.club_id is not null
  group by c.personal_id, c.club_id
)
update public.personal p
set club_id = u.club_id
from uso_por_club u
where p.id_personal = u.id_personal
  and u.rn = 1
  and p.club_id is null;

create index if not exists personal_club_id_idx
  on public.personal(club_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_club_id_fkey'
      and conrelid = 'public.personal'::regclass
  ) then
    alter table public.personal
      add constraint personal_club_id_fkey
      foreign key (club_id)
      references public.clubes(id_club)
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.personal
  validate constraint personal_club_id_fkey;

do $$
begin
  if not exists (
    select 1 from public.personal where club_id is null
  ) then
    alter table public.personal
      alter column club_id set not null;
  else
    raise notice 'Quedan filas en public.personal sin club_id. Revisalas antes de marcar la columna como NOT NULL.';
  end if;
end $$;

commit;

-- Auditoria posterior recomendada:
-- select id_personal, nombre, nif, tipo
-- from public.personal
-- where club_id is null
-- order by nombre;

