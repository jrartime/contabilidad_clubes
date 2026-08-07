-- Añade Gastos varios al catálogo de todos los clubes actuales.
-- La inserción es idempotente y no duplica variantes de mayúsculas o espacios.

insert into public.conceptos (club_id, concepto)
select club.id_club, 'Gastos varios'
from public.clubes club
where not exists (
  select 1
  from public.conceptos existente
  where existente.club_id = club.id_club
    and lower(btrim(existente.concepto)) = lower('Gastos varios')
);
