-- Auditoria de convivencia entre public.documentos y public.contabilidad_documentos.
-- No modifica datos.

select 'documentos' as source, count(*) as rows
from public.documentos

union all

select 'contabilidad_documentos' as source, count(*) as rows
from public.contabilidad_documentos;

select
  'documentos_por_tipo_bucket' as report,
  tipo,
  bucket,
  count(*) as rows
from public.documentos
group by tipo, bucket
order by tipo, bucket;

select
  'contabilidad_documentos_por_bucket' as report,
  bucket,
  count(*) as rows
from public.contabilidad_documentos
group by bucket
order by bucket;

select
  'documentos_sin_storage_object' as issue,
  count(*) as rows
from public.documentos d
left join storage.objects o
  on o.bucket_id = d.bucket
 and o.name = d.path
where o.id is null;

select
  'contabilidad_documentos_sin_storage_object' as issue,
  count(*) as rows
from public.contabilidad_documentos d
left join storage.objects o
  on o.bucket_id = d.bucket
 and o.name = d.path
where o.id is null;

select
  'storage_objects_sin_documento' as issue,
  o.bucket_id,
  count(*) as rows
from storage.objects o
left join public.documentos d
  on d.bucket = o.bucket_id
 and d.path = o.name
left join public.contabilidad_documentos cd
  on cd.bucket = o.bucket_id
 and cd.path = o.name
where o.bucket_id in ('facturas', 'nominas')
  and d.id is null
  and cd.id_documento is null
group by o.bucket_id
order by o.bucket_id;

