-- Migracion de datos: public.contabilidad_documentos -> public.documentos.
--
-- No borra public.contabilidad_documentos. Solo copia registros que no existan ya
-- en public.documentos por bucket/path.

begin;

insert into public.documentos (
  club_id,
  tipo,
  bucket,
  path,
  filename,
  content_type,
  size_bytes,
  contabilidad_id,
  nomina_id,
  created_at
)
select
  cd.club_id,
  case
    when cd.bucket = 'nominas' then 'nomina'
    else 'factura'
  end as tipo,
  cd.bucket,
  cd.path,
  cd.filename,
  cd.mime as content_type,
  cd.size as size_bytes,
  case
    when cd.bucket = 'nominas' then null
    else cd.contabilidad_id
  end as contabilidad_id,
  case
    when cd.bucket = 'nominas' then cd.contabilidad_id
    else null
  end as nomina_id,
  cd.created_at
from public.contabilidad_documentos cd
where not exists (
  select 1
  from public.documentos d
  where d.bucket = cd.bucket
    and d.path = cd.path
);

commit;

