-- Torneo los Prados y Torneo Pablo Morán -> Gastos varios.

begin;

with conceptos_antiguos(concepto) as (
  values ('Torneo los Prados'), ('Torneo Pablo Morán')
), conversiones as (
  select a.club_id, a.id_concepto id_antiguo, a.concepto nombre_antiguo, o.id_concepto id_oficial
  from conceptos_antiguos listado
  join public.conceptos a on lower(btrim(a.concepto)) = lower(listado.concepto)
  join public.conceptos o on o.club_id = a.club_id and lower(btrim(o.concepto)) = lower('Gastos varios')
)
update public.contabilidad c
set
  concepto_id = x.id_oficial,
  observaciones = concat_ws(E'\n', nullif(btrim(c.observaciones), ''), 'Concepto anterior: ' || x.nombre_antiguo)
from conversiones x
where c.club_id = x.club_id and c.concepto_id = x.id_antiguo;

with conceptos_antiguos(concepto) as (
  values ('Torneo los Prados'), ('Torneo Pablo Morán')
), conversiones as (
  select a.club_id, a.id_concepto id_antiguo, o.id_concepto id_oficial
  from conceptos_antiguos listado
  join public.conceptos a on lower(btrim(a.concepto)) = lower(listado.concepto)
  join public.conceptos o on o.club_id = a.club_id and lower(btrim(o.concepto)) = lower('Gastos varios')
)
update public.bancos b
set concepto_id = x.id_oficial
from conversiones x
where b.club_id = x.club_id and b.concepto_id = x.id_antiguo;

with conceptos_antiguos(concepto) as (
  values ('Torneo los Prados'), ('Torneo Pablo Morán')
)
delete from public.conceptos c
using conceptos_antiguos listado
where lower(btrim(c.concepto)) = lower(listado.concepto)
  and not exists (select 1 from public.contabilidad x where x.concepto_id = c.id_concepto)
  and not exists (select 1 from public.bancos x where x.concepto_id = c.id_concepto);

commit;
