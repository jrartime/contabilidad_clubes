-- Unifica Gastos varios dentro de Otros y admite Otros en los tres programas.
-- Reintegro de subvención permanece como concepto independiente no oficial.

begin;

update public.conceptos
set
  en_listado = true,
  valido_clubes = true,
  valido_eventos = true,
  valido_eedd_ctd_discapacidad = true,
  naturaleza = 'gasto'
where lower(btrim(concepto)) = lower('Otros');

with conversiones as (
  select a.club_id, a.id_concepto id_antiguo, o.id_concepto id_oficial
  from public.conceptos a
  join public.conceptos o
    on o.club_id = a.club_id
   and lower(btrim(o.concepto)) = lower('Otros')
  where lower(btrim(a.concepto)) = lower('Gastos varios')
)
update public.contabilidad c
set concepto_id = x.id_oficial
from conversiones x
where c.club_id = x.club_id and c.concepto_id = x.id_antiguo;

with conversiones as (
  select a.club_id, a.id_concepto id_antiguo, o.id_concepto id_oficial
  from public.conceptos a
  join public.conceptos o
    on o.club_id = a.club_id
   and lower(btrim(o.concepto)) = lower('Otros')
  where lower(btrim(a.concepto)) = lower('Gastos varios')
)
update public.bancos b
set concepto_id = x.id_oficial
from conversiones x
where b.club_id = x.club_id and b.concepto_id = x.id_antiguo;

delete from public.conceptos c
where lower(btrim(c.concepto)) = lower('Gastos varios')
  and not exists (select 1 from public.contabilidad x where x.concepto_id = c.id_concepto)
  and not exists (select 1 from public.bancos x where x.concepto_id = c.id_concepto);

update public.conceptos
set
  naturaleza = 'gasto',
  en_listado = false,
  valido_clubes = false,
  valido_eventos = false,
  valido_eedd_ctd_discapacidad = false
where lower(btrim(concepto)) = lower('Reintegro de subvención');

commit;
