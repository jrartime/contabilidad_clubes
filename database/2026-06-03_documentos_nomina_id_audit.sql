-- Auditoria previa para normalizar public.documentos.nomina_id.
-- No modifica datos.
--
-- En el modelo actual no existe public.nominas:
-- una nomina es public.contabilidad.id_contabilidad con tipo_id = 3.

select 'documentos.nomina_id sin asiento contable' as issue, count(*) as rows
from public.documentos d
left join public.contabilidad c on c.id_contabilidad = d.nomina_id
where d.nomina_id is not null
  and c.id_contabilidad is null

union all

select 'documentos.nomina_id apunta a contabilidad no nomina' as issue, count(*) as rows
from public.documentos d
join public.contabilidad c on c.id_contabilidad = d.nomina_id
where d.nomina_id is not null
  and coalesce(c.tipo_id, 0) <> 3;

