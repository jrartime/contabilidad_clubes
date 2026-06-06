-- Auditoria previa para FKs de public.documentos.
-- No modifica datos.

select 'documentos.club_id sin club' as issue, count(*) as rows
from public.documentos d
left join public.clubes c on c.id_club = d.club_id
where c.id_club is null

union all

select 'documentos.contabilidad_id sin asiento' as issue, count(*) as rows
from public.documentos d
left join public.contabilidad c on c.id_contabilidad = d.contabilidad_id
where d.contabilidad_id is not null
  and c.id_contabilidad is null

union all

select 'documentos.personal_id sin personal' as issue, count(*) as rows
from public.documentos d
left join public.personal p on p.id_personal = d.personal_id
where d.personal_id is not null
  and p.id_personal is null

union all

select 'documentos.programa_id sin programa' as issue, count(*) as rows
from public.documentos d
left join public.programas p on p.id_programa = d.programa_id
where d.programa_id is not null
  and p.id_programa is null;
