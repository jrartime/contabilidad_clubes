-- Inventario especifico de columnas *_id sin foreign key.
-- No modifica estructura ni datos.
--
-- Ejecutar en Supabase SQL Editor.

with fk_columns as (
  select
    kcu.table_name,
    kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
   and kcu.table_name = tc.table_name
  where tc.table_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
),
candidate_columns as (
  select
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
  left join fk_columns fk
    on fk.table_name = c.table_name
   and fk.column_name = c.column_name
  where c.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and c.column_name ~ '(^|_)[a-z0-9]+_id$'
    and fk.column_name is null
    and c.table_name !~ '^stg_'
)
select
  cc.table_name,
  cc.column_name,
  cc.data_type,
  cc.is_nullable,
  case cc.column_name
    when 'club_id' then 'public.clubes(id_club)'
    when 'proveedor_id' then 'public.proveedores(id_proveedor)'
    when 'personal_id' then 'public.personal(id_personal)'
    when 'programa_id' then 'public.programas(id_programa)'
    when 'categoria_id' then 'public.categorias(id_categoria)'
    when 'concepto_id' then 'public.conceptos(id_concepto)'
    when 'entidad_id' then 'public.entidades(id_entidad)'
    when 'tipo_id' then 'public.tipos(id_tipo)'
    when 'contabilidad_id' then 'public.contabilidad(id_contabilidad)'
    when 'nomina_id' then 'public.contabilidad(id_contabilidad) where tipo_id = 3'
    when 'banco_id' then 'public.bancos(id_banco)'
    when 'user_id' then 'auth.users(id) or public.perfiles(user_id)'
    else null
  end as suggested_reference
from candidate_columns cc
order by cc.table_name, cc.column_name;
