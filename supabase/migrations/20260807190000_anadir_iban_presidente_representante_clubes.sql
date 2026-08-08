-- ============================================================================
-- MIGRACIÓN: datos bancarios y de representación legal del club
-- Fecha lógica: 2026-08-07 19:00:00
--
-- Alcance: añade a public.clubes cinco columnas de texto, todas opcionales
-- (nullable, sin default), para poder registrar el IBAN de la cuenta del
-- club y la identificación (nombre y DNI) del Presidente y del Representante.
-- No modifica filas existentes, RLS, triggers, funciones ni otras tablas.
-- ============================================================================

begin;

do $guard$
begin
  if to_regclass('public.clubes') is null then
    raise exception 'Guard: no existe public.clubes.';
  end if;
end;
$guard$;

alter table public.clubes
  add column if not exists iban text,
  add column if not exists presidente_nombre text,
  add column if not exists presidente_dni text,
  add column if not exists representante_nombre text,
  add column if not exists representante_dni text;

commit;

-- ---------------------------------------------------------------------------
-- Verificación posterior de solo lectura
-- ---------------------------------------------------------------------------
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'clubes'
--   and column_name in (
--     'iban', 'presidente_nombre', 'presidente_dni',
--     'representante_nombre', 'representante_dni'
--   )
-- order by column_name;

-- ============================================================================
-- ROLLBACK
-- Reversible sin pérdida de datos salvo que ya se hayan rellenado estas
-- columnas, en cuyo caso su contenido se perdería al eliminarlas.
-- ============================================================================
-- alter table public.clubes
--   drop column if exists iban,
--   drop column if exists presidente_nombre,
--   drop column if exists presidente_dni,
--   drop column if exists representante_nombre,
--   drop column if exists representante_dni;
