-- Inventario de esquema para normalizacion PostgreSQL/Supabase.
--
-- Este archivo NO modifica datos ni estructura. Solo devuelve resultados.
-- Ejecutar en Supabase SQL Editor y revisar cada bloque de resultados.

-- 1. Tablas public con RLS y conteo estimado.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- 2. Columnas public con tipos, nullability y defaults.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3. Nombres de tablas/columnas fuera de lower_snake_case.
with table_issues as (
  select
    'table' as object_type,
    table_name as object_name,
    null::text as column_name,
    'name_not_lower_snake_case' as issue
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and table_name !~ '^[a-z][a-z0-9_]*$'
),
column_issues as (
  select
    'column' as object_type,
    table_name as object_name,
    column_name,
    'name_not_lower_snake_case' as issue
  from information_schema.columns
  where table_schema = 'public'
    and column_name !~ '^[a-z][a-z0-9_]*$'
)
select *
from table_issues
union all
select *
from column_issues
order by object_type, object_name, column_name;

-- 4. Claves primarias.
select
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as primary_key_columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
where tc.table_schema = 'public'
  and tc.constraint_type = 'PRIMARY KEY'
group by tc.table_name, tc.constraint_name
order by tc.table_name;

-- 5. Claves foraneas.
select
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_schema = tc.constraint_schema
 and ccu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 6. Columnas que parecen FK por nombre pero no tienen constraint FK.
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
)
select
  c.table_name,
  c.column_name,
  c.data_type
from information_schema.columns c
left join fk_columns fk
  on fk.table_name = c.table_name
 and fk.column_name = c.column_name
where c.table_schema = 'public'
  and c.column_name ~ '(^|_)[a-z0-9]+_id$'
  and fk.column_name is null
order by c.table_name, c.column_name;

-- 7. Tablas de negocio sin club_id. Revisar si deben ser por club o catalogo global.
select
  t.table_name
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = t.table_schema
      and c.table_name = t.table_name
      and c.column_name = 'club_id'
  )
  and t.table_name not in (
    'spatial_ref_sys'
  )
order by t.table_name;

-- 8. Politicas RLS existentes.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

