-- ============================================================================
-- MIGRACIÓN: proteger la pertenencia a subvención durante el cierre
-- Fecha lógica: 2026-08-07 17:00:00
--
-- Alcance deliberadamente limitado:
--   - Modifica solamente public.validate_presupuesto_header().
--   - No cambia tablas, datos, RLS, triggers, Storage ni la interfaz.
--   - Conserva literalmente todas las validaciones y snapshots existentes.
--
-- Problema resuelto:
--   Un NOT EXISTS ordinario puede confirmar que una relación existe mientras
--   otra transacción la elimina o modifica. El cierre podría entonces terminar
--   utilizando una comprobación que ya no representa el estado confirmado.
--
-- Solución:
--   Durante borrador -> cerrado se bloquean con FOR SHARE, y en orden estable,
--   las filas de subvencion_programas que cubren los programas del presupuesto.
--   FOR SHARE impide DELETE y cualquier UPDATE de esas filas hasta que finalice
--   el cierre, incluida una modificación de club_id. Después se compara el
--   número bloqueado con el número total de programas incluidos.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Guards de existencia y de definición auditada
-- ---------------------------------------------------------------------------

do $guards$
declare
  v_function_oid oid;
  v_body_md5 text;
  v_security_definer boolean;
  v_config text[];
  v_language text;
  v_result text;
  v_arguments text;
begin
  -- Las tres tablas son requisitos funcionales. to_regclass evita que una
  -- referencia inexistente produzca un error poco informativo.
  if to_regclass('public.presupuestos') is null then
    raise exception 'Guard de cierre: no existe public.presupuestos.';
  end if;

  if to_regclass('public.presupuesto_programas') is null then
    raise exception 'Guard de cierre: no existe public.presupuesto_programas.';
  end if;

  if to_regclass('public.subvencion_programas') is null then
    raise exception 'Guard de cierre: no existe public.subvencion_programas.';
  end if;

  -- La resolución mediante to_regprocedure comprueba nombre y firma sin hacer
  -- fallar prematuramente el propio bloque de guards.
  v_function_oid := to_regprocedure('public.validate_presupuesto_header()');
  if v_function_oid is null then
    raise exception 'Guard de cierre: no existe public.validate_presupuesto_header().';
  end if;

  select
    md5(replace(p.prosrc, E'\r\n', E'\n')),
    p.prosecdef,
    p.proconfig,
    l.lanname,
    pg_get_function_result(p.oid),
    pg_get_function_arguments(p.oid)
  into
    v_body_md5,
    v_security_definer,
    v_config,
    v_language,
    v_result,
    v_arguments
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_language as l
    on l.oid = p.prolang
  where p.oid = v_function_oid;

  -- Este fingerprint corresponde al cuerpo remoto auditado inmediatamente
  -- antes de generar la migración. Cualquier cambio posterior aborta en vez de
  -- ser sobrescrito silenciosamente por la sustitución de abajo.
  if v_body_md5 <> '407ed3be8dad1ef6ed6c91bb9e187336' then
    raise exception
      'Guard de cierre: validate_presupuesto_header() ha cambiado (MD5 actual: %, esperado: %).',
      v_body_md5,
      '407ed3be8dad1ef6ed6c91bb9e187336';
  end if;

  if v_security_definer is not true
     or v_language <> 'plpgsql'
     or v_result <> 'trigger'
     or v_arguments <> ''
     or v_config is distinct from array['search_path=""']::text[]
  then
    raise exception
      'Guard de cierre: la firma, lenguaje, SECURITY DEFINER o search_path de la función no coincide con la definición auditada.';
  end if;
end;
$guards$;

-- ---------------------------------------------------------------------------
-- 2. Inserción mínima del bloqueo dentro de la función existente
-- ---------------------------------------------------------------------------

do $replace_function$
declare
  v_definition text;
  v_anchor text := $anchor$
    if v_programas_incompatibles > 0 then
      raise exception
        'No puede cerrarse el presupuesto: % programa(s) son incompatibles.',
        v_programas_incompatibles;
    end if;
$anchor$;
  v_locked_validation text := $locked_validation$

    -- Si el presupuesto tiene subvención, cada programa debe conservar su
    -- relación explícita en el instante del cierre. El orden por PK hace que dos
    -- cierres concurrentes adquieran bloqueos compartidos de forma estable.
    if new.subvencion_id is not null then
      select count(*)
      into v_total_programas
      from public.presupuesto_programas as pp
      where pp.presupuesto_id = new.id_presupuesto
        and pp.club_id = new.club_id;

      -- FOR SHARE protege la fila completa frente a DELETE y UPDATE, no solo
      -- sus columnas de clave. Si una modificación llegó primero, esta consulta
      -- espera y después deja fuera la fila ya incompatible; si el cierre llega
      -- primero, la modificación espera hasta que aquel confirme o revierta.
      perform sp.id_subvencion_programa
      from public.presupuesto_programas as pp
      join public.subvencion_programas as sp
        on sp.subvencion_id = new.subvencion_id
       and sp.programa_id = pp.programa_id
       and sp.club_id = new.club_id
      where pp.presupuesto_id = new.id_presupuesto
        and pp.club_id = new.club_id
      order by sp.id_subvencion_programa
      for share of sp;

      get diagnostics v_subvencion_programas_bloqueados = row_count;

      if v_subvencion_programas_bloqueados <> v_total_programas then
        raise exception
          'No puede cerrarse el presupuesto: solo % de % programa(s) siguen vinculados a la subvención del mismo club.',
          v_subvencion_programas_bloqueados,
          v_total_programas;
      end if;
    end if;
$locked_validation$;
begin
  -- pg_get_functiondef conserva firma, atributos y todo el cuerpo auditado.
  -- Solo se amplía la declaración con dos contadores y se inserta el bloque
  -- anterior exactamente después de la validación de programas existente.
  v_definition := pg_get_functiondef(
    'public.validate_presupuesto_header()'::regprocedure
  );

  if strpos(v_definition, '  v_partidas_snapshot bigint;') = 0
     or strpos(v_definition, v_anchor) = 0
  then
    raise exception
      'Guard de cierre: no se encontraron los puntos exactos de inserción en validate_presupuesto_header().';
  end if;

  v_definition := replace(
    v_definition,
    '  v_partidas_snapshot bigint;',
    E'  v_partidas_snapshot bigint;\n  v_total_programas bigint;\n  v_subvencion_programas_bloqueados bigint;'
  );

  v_definition := replace(
    v_definition,
    v_anchor,
    v_anchor || v_locked_validation
  );

  execute v_definition;
end;
$replace_function$;

commit;

-- ---------------------------------------------------------------------------
-- 3. Verificaciones posteriores de solo lectura
-- ---------------------------------------------------------------------------
-- Ejecutar después de aplicar la migración:
--
-- select
--   p.oid::regprocedure as funcion,
--   p.prosecdef as security_definer,
--   p.proconfig as configuracion,
--   md5(replace(p.prosrc, E'\r\n', E'\n')) as body_md5,
--   strpos(p.prosrc, 'for share of sp') > 0 as contiene_bloqueo,
--   strpos(p.prosrc, 'v_subvencion_programas_bloqueados') > 0 as contiene_recuento
-- from pg_catalog.pg_proc as p
-- where p.oid = 'public.validate_presupuesto_header()'::regprocedure;
--
-- select tgname, tgenabled
-- from pg_catalog.pg_trigger
-- where tgrelid = 'public.presupuestos'::regclass
--   and not tgisinternal
-- order by tgname;

-- ============================================================================
-- ROLLBACK COMPLETO Y SEGURO
--
-- Este bloque no forma parte de la ejecución normal. Para revertir, copiarlo a
-- una migración posterior y descomentar BEGIN/DO/COMMENT/COMMIT. La reversión
-- elimina exclusivamente las dos variables y el bloque insertado arriba.
-- Primero exige que el cuerpo siga siendo exactamente el creado por esta
-- migración, evitando borrar cambios posteriores inesperados.
-- ============================================================================
--
-- begin;
--
-- do $rollback$
-- declare
--   v_oid oid := to_regprocedure('public.validate_presupuesto_header()');
--   v_definition text;
--   v_body_md5 text;
--   v_anchor text := $anchor$
--     if v_programas_incompatibles > 0 then
--       raise exception
--         'No puede cerrarse el presupuesto: % programa(s) son incompatibles.',
--         v_programas_incompatibles;
--     end if;
-- $anchor$;
--   v_locked_validation text := $locked_validation$
--
--     -- Si el presupuesto tiene subvención, cada programa debe conservar su
--     -- relación explícita en el instante del cierre. El orden por PK hace que dos
--     -- cierres concurrentes adquieran bloqueos compartidos de forma estable.
--     if new.subvencion_id is not null then
--       select count(*)
--       into v_total_programas
--       from public.presupuesto_programas as pp
--       where pp.presupuesto_id = new.id_presupuesto
--         and pp.club_id = new.club_id;
--
--       -- FOR SHARE protege la fila completa frente a DELETE y UPDATE, no solo
--       -- sus columnas de clave. Si una modificación llegó primero, esta consulta
--       -- espera y después deja fuera la fila ya incompatible; si el cierre llega
--       -- primero, la modificación espera hasta que aquel confirme o revierta.
--       perform sp.id_subvencion_programa
--       from public.presupuesto_programas as pp
--       join public.subvencion_programas as sp
--         on sp.subvencion_id = new.subvencion_id
--        and sp.programa_id = pp.programa_id
--        and sp.club_id = new.club_id
--       where pp.presupuesto_id = new.id_presupuesto
--         and pp.club_id = new.club_id
--       order by sp.id_subvencion_programa
--       for share of sp;
--
--       get diagnostics v_subvencion_programas_bloqueados = row_count;
--
--       if v_subvencion_programas_bloqueados <> v_total_programas then
--         raise exception
--           'No puede cerrarse el presupuesto: solo % de % programa(s) siguen vinculados a la subvención del mismo club.',
--           v_subvencion_programas_bloqueados,
--           v_total_programas;
--       end if;
--     end if;
-- $locked_validation$;
-- begin
--   if v_oid is null then
--     raise exception 'Rollback de cierre: no existe public.validate_presupuesto_header().';
--   end if;
--
--   select md5(replace(p.prosrc, E'\r\n', E'\n'))
--   into v_body_md5
--   from pg_catalog.pg_proc as p
--   where p.oid = v_oid;
--
--   if v_body_md5 <> '95dc6b97a5644174e4837edf796dda96' then
--     raise exception
--       'Rollback de cierre: la función ha cambiado (MD5 actual: %, esperado: %).',
--       v_body_md5,
--       '95dc6b97a5644174e4837edf796dda96';
--   end if;
--
--   v_definition := pg_get_functiondef(v_oid);
--   v_definition := replace(v_definition, v_anchor || v_locked_validation, v_anchor);
--   v_definition := replace(
--     v_definition,
--     E'  v_partidas_snapshot bigint;\n  v_total_programas bigint;\n  v_subvencion_programas_bloqueados bigint;',
--     '  v_partidas_snapshot bigint;'
--   );
--
--   execute v_definition;
-- end;
-- $rollback$;
--
-- commit;
