-- Migración 1: unificar pertenencia y separar lectura de escritura en RLS.
--
-- Objetivos:
--   1. Usar public.club_miembros como única fuente de pertenencia a clubes.
--   2. Permitir lectura a cualquier miembro del club, incluido viewer.
--   3. Permitir escritura solo a owner, admin y manager.
--   4. Mantener acceso global para los administradores de public.perfiles.
--   5. Reemplazar las políticas FOR ALL por políticas por operación.
--
-- Fuera de alcance de esta migración:
--   - public.clubes y sus políticas.
--   - public.club_miembros y sus políticas o datos.
--   - public.user_clubs y sus datos.
--   - Los roles almacenados actualmente.
--   - Cualquier dato de negocio.

begin;

-- ============================================================================
-- 1. COMPROBACIONES PREVIAS DE SEGURIDAD
-- ============================================================================

-- Verifica que las tablas necesarias para evaluar pertenencia y administración
-- global existen antes de modificar funciones o políticas.
do $required_tables_guard$
begin
  if to_regclass('public.club_miembros') is null then
    raise exception
      'Migración cancelada: no existe public.club_miembros';
  end if;

  if to_regclass('public.perfiles') is null then
    raise exception
      'Migración cancelada: no existe public.perfiles';
  end if;

  if to_regclass('public.user_clubs') is null then
    raise exception
      'Migración cancelada: no existe public.user_clubs y no se puede comparar el acceso heredado';
  end if;
end;
$required_tables_guard$;

-- Evita retirar acceso de lectura a un usuario que todavía figure únicamente
-- en user_clubs. Los administradores globales quedan excluidos porque seguirán
-- obteniendo acceso mediante public.is_admin().
do $legacy_access_guard$
begin
  if exists (
    select 1
    from public.user_clubs as legacy_membership
    where not exists (
      select 1
      from public.club_miembros as canonical_membership
      where canonical_membership.user_id = legacy_membership.user_id
        and canonical_membership.club_id = legacy_membership.club_id
    )
    and not exists (
      select 1
      from public.perfiles as profile
      where profile.user_id = legacy_membership.user_id
        and profile.rol = 'admin'
    )
  ) then
    raise exception
      'Migración cancelada: existen accesos de user_clubs sin correspondencia en club_miembros';
  end if;
end;
$legacy_access_guard$;

-- Evita retirar permiso de escritura a un club_admin heredado que no tenga un
-- rol editable equivalente en club_miembros. No modifica ni traduce roles.
do $legacy_edit_guard$
begin
  if exists (
    select 1
    from public.user_clubs as legacy_membership
    where legacy_membership.club_rol = 'club_admin'
      and not exists (
        select 1
        from public.club_miembros as canonical_membership
        where canonical_membership.user_id = legacy_membership.user_id
          and canonical_membership.club_id = legacy_membership.club_id
          and canonical_membership.rol in ('owner', 'admin', 'manager')
      )
      and not exists (
        select 1
        from public.perfiles as profile
        where profile.user_id = legacy_membership.user_id
          and profile.rol = 'admin'
      )
  ) then
    raise exception
      'Migración cancelada: existen permisos de edición heredados sin rol editable equivalente';
  end if;
end;
$legacy_edit_guard$;

-- Rechaza roles que esta migración no pueda clasificar de forma explícita.
-- El conjunto es compatible con el modelo TypeScript actual.
do $known_roles_guard$
begin
  if exists (
    select 1
    from public.club_miembros as membership
    where membership.rol not in ('owner', 'admin', 'manager', 'viewer')
  ) then
    raise exception
      'Migración cancelada: club_miembros contiene roles no reconocidos';
  end if;
end;
$known_roles_guard$;

-- Comprueba que siguen existiendo las trece políticas FOR ALL auditadas.
-- Si el esquema remoto cambió desde la auditoría, la migración se detiene
-- para no reemplazar silenciosamente una configuración distinta.
do $all_policies_guard$
declare
  expected_policy record;
begin
  for expected_policy in
    select *
    from (
      values
        ('bancos', 'bancos_all'),
        ('checklist_justificacion', 'checklist_all'),
        ('conceptos', 'conceptos_all'),
        ('contabilidad', 'contabilidad_all'),
        ('entidades', 'entidades_all'),
        ('imputaciones', 'imputaciones_all'),
        ('pagos', 'pagos_all'),
        ('personal', 'personal_all'),
        ('programas', 'programas_all'),
        ('proveedores', 'proveedores_all'),
        ('subvencion_programas', 'subvencion_programas_all'),
        ('subvenciones', 'subvenciones_all'),
        ('tipos', 'tipos_all')
    ) as policies(table_name, policy_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = expected_policy.table_name
        and policy.policyname = expected_policy.policy_name
        and policy.cmd = 'ALL'
        and coalesce(policy.qual, '') = 'can_access_club(club_id)'
        and coalesce(policy.with_check, '') = 'can_access_club(club_id)'
    ) then
      raise exception
        'Migración cancelada: la política %.% no coincide con el estado auditado',
        expected_policy.table_name,
        expected_policy.policy_name;
    end if;
  end loop;
end;
$all_policies_guard$;

-- Comprueba que todavía no existe ninguna de las políticas nuevas que se
-- crearán para las trece tablas. La migración se detiene si encuentra una para
-- evitar sobrescribir o mezclar una configuración aplicada parcialmente.
do $new_policies_absence_guard$
declare
  target_table text;
  policy_suffix text;
  unexpected_policy_name text;
begin
  foreach target_table in array array[
    'bancos',
    'checklist_justificacion',
    'conceptos',
    'contabilidad',
    'entidades',
    'imputaciones',
    'pagos',
    'personal',
    'programas',
    'proveedores',
    'subvencion_programas',
    'subvenciones',
    'tipos'
  ]
  loop
    foreach policy_suffix in array array[
      '_select_by_club',
      '_insert_by_club',
      '_update_by_club',
      '_delete_by_club'
    ]
    loop
      unexpected_policy_name := target_table || policy_suffix;

      if exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = target_table
          and policy.policyname = unexpected_policy_name
      ) then
        raise exception
          'Migración cancelada: ya existe inesperadamente la política %.%',
          target_table,
          unexpected_policy_name;
      end if;
    end loop;
  end loop;
end;
$new_policies_absence_guard$;

-- Comprueba que las ocho políticas documentales auditadas conservan nombre,
-- operación, USING y WITH CHECK. Si cualquiera de sus predicados cambió desde
-- la auditoría, la migración se detiene antes de sobrescribirla.
do $document_policies_guard$
declare
  expected_policy record;
begin
  for expected_policy in
    select *
    from (
      values
        ('documentos', 'documentos_select_by_club', 'SELECT', 'can_access_club(club_id)', ''),
        ('documentos', 'documentos_insert_by_club', 'INSERT', '', 'can_access_club(club_id)'),
        ('documentos', 'documentos_update_by_club', 'UPDATE', 'can_access_club(club_id)', 'can_access_club(club_id)'),
        ('documentos', 'documentos_delete_by_club', 'DELETE', 'can_access_club(club_id)', ''),
        ('contabilidad_documentos', 'contabilidad_documentos_select_by_club', 'SELECT', 'can_access_club(club_id)', ''),
        ('contabilidad_documentos', 'contabilidad_documentos_insert_by_club', 'INSERT', '', 'can_access_club(club_id)'),
        ('contabilidad_documentos', 'contabilidad_documentos_update_by_club', 'UPDATE', 'can_access_club(club_id)', 'can_access_club(club_id)'),
        ('contabilidad_documentos', 'contabilidad_documentos_delete_by_club', 'DELETE', 'can_access_club(club_id)', '')
    ) as policies(
      table_name,
      policy_name,
      command_name,
      expected_qual,
      expected_with_check
    )
  loop
    if not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = expected_policy.table_name
        and policy.policyname = expected_policy.policy_name
        and policy.cmd = expected_policy.command_name
        and coalesce(policy.qual, '') = expected_policy.expected_qual
        and coalesce(policy.with_check, '') = expected_policy.expected_with_check
    ) then
      raise exception
        'Migración cancelada: la política documental %.% no coincide con el estado auditado',
        expected_policy.table_name,
        expected_policy.policy_name;
    end if;
  end loop;
end;
$document_policies_guard$;

-- ============================================================================
-- 2. FUNCIONES DE AUTORIZACIÓN
-- ============================================================================

-- Autoriza lectura a administradores globales y a cualquier miembro del club.
--
-- SECURITY DEFINER es necesario para consultar club_miembros de forma estable
-- sin quedar condicionado por el RLS de la propia tabla de membresías.
--
-- El search_path vacío y los nombres totalmente cualificados evitan resolver
-- accidentalmente objetos homónimos de otros esquemas.
create or replace function public.can_access_club(p_club_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    public.is_admin()
    or exists (
      select 1
      from public.club_miembros as membership
      where membership.user_id = auth.uid()
        and membership.club_id = p_club_id
    );
$function$;

-- Autoriza escritura a administradores globales y a miembros con rol owner,
-- admin o manager. El rol viewer conserva lectura, pero no puede escribir.
create or replace function public.can_edit_club(p_club_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    public.is_admin()
    or exists (
      select 1
      from public.club_miembros as membership
      where membership.user_id = auth.uid()
        and membership.club_id = p_club_id
        and membership.rol in ('owner', 'admin', 'manager')
    );
$function$;

-- ============================================================================
-- 3. SUSTITUCIÓN DE POLÍTICAS FOR ALL
-- ============================================================================

-- Políticas que se eliminan exactamente en este bloque:
--   bancos_all
--   checklist_all
--   conceptos_all
--   contabilidad_all
--   entidades_all
--   imputaciones_all
--   pagos_all
--   personal_all
--   programas_all
--   proveedores_all
--   subvencion_programas_all
--   subvenciones_all
--   tipos_all
--
-- Por cada tabla se crean exactamente cuatro políticas:
--   {tabla}_select_by_club
--   {tabla}_insert_by_club
--   {tabla}_update_by_club
--   {tabla}_delete_by_club
do $split_all_policies$
declare
  policy_config record;
begin
  for policy_config in
    select *
    from (
      values
        ('bancos', 'bancos_all'),
        ('checklist_justificacion', 'checklist_all'),
        ('conceptos', 'conceptos_all'),
        ('contabilidad', 'contabilidad_all'),
        ('entidades', 'entidades_all'),
        ('imputaciones', 'imputaciones_all'),
        ('pagos', 'pagos_all'),
        ('personal', 'personal_all'),
        ('programas', 'programas_all'),
        ('proveedores', 'proveedores_all'),
        ('subvencion_programas', 'subvencion_programas_all'),
        ('subvenciones', 'subvenciones_all'),
        ('tipos', 'tipos_all')
    ) as policies(table_name, old_policy_name)
  loop
    -- Elimina la política FOR ALL auditada.
    execute format(
      'drop policy %I on public.%I',
      policy_config.old_policy_name,
      policy_config.table_name
    );

    -- SELECT: cualquier miembro legítimo del club puede leer.
    execute format(
      'create policy %I on public.%I
         for select
         to authenticated
         using (public.can_access_club(club_id))',
      policy_config.table_name || '_select_by_club',
      policy_config.table_name
    );

    -- INSERT: solo se aceptan filas para clubes que el usuario puede editar.
    execute format(
      'create policy %I on public.%I
         for insert
         to authenticated
         with check (public.can_edit_club(club_id))',
      policy_config.table_name || '_insert_by_club',
      policy_config.table_name
    );

    -- UPDATE: exige permiso tanto sobre la fila existente como sobre el estado
    -- resultante. Esto impide trasladar una fila a un club no editable.
    execute format(
      'create policy %I on public.%I
         for update
         to authenticated
         using (public.can_edit_club(club_id))
         with check (public.can_edit_club(club_id))',
      policy_config.table_name || '_update_by_club',
      policy_config.table_name
    );

    -- DELETE: solo los usuarios con permiso de edición pueden borrar.
    execute format(
      'create policy %I on public.%I
         for delete
         to authenticated
         using (public.can_edit_club(club_id))',
      policy_config.table_name || '_delete_by_club',
      policy_config.table_name
    );
  end loop;
end;
$split_all_policies$;

-- ============================================================================
-- 4. ACTUALIZACIÓN DE POLÍTICAS DE DOCUMENTOS
-- ============================================================================

-- Políticas que se eliminan y vuelven a crear con el mismo nombre:
--   documentos_select_by_club
--   documentos_insert_by_club
--   documentos_update_by_club
--   documentos_delete_by_club
--   contabilidad_documentos_select_by_club
--   contabilidad_documentos_insert_by_club
--   contabilidad_documentos_update_by_club
--   contabilidad_documentos_delete_by_club

-- DOCUMENTOS -----------------------------------------------------------------

drop policy documentos_select_by_club on public.documentos;
drop policy documentos_insert_by_club on public.documentos;
drop policy documentos_update_by_club on public.documentos;
drop policy documentos_delete_by_club on public.documentos;

-- Los miembros, incluido viewer, pueden consultar metadatos documentales.
create policy documentos_select_by_club
  on public.documentos
  for select
  to authenticated
  using (public.can_access_club(club_id));

-- Solo owner, admin, manager o administrador global pueden crear metadatos.
create policy documentos_insert_by_club
  on public.documentos
  for insert
  to authenticated
  with check (public.can_edit_club(club_id));

-- Solo los usuarios con permiso de edición pueden modificar metadatos y no
-- pueden mover una fila hacia un club para el que carezcan de permiso.
create policy documentos_update_by_club
  on public.documentos
  for update
  to authenticated
  using (public.can_edit_club(club_id))
  with check (public.can_edit_club(club_id));

-- Solo los usuarios con permiso de edición pueden borrar metadatos.
create policy documentos_delete_by_club
  on public.documentos
  for delete
  to authenticated
  using (public.can_edit_club(club_id));

-- CONTABILIDAD_DOCUMENTOS ----------------------------------------------------

drop policy contabilidad_documentos_select_by_club
  on public.contabilidad_documentos;
drop policy contabilidad_documentos_insert_by_club
  on public.contabilidad_documentos;
drop policy contabilidad_documentos_update_by_club
  on public.contabilidad_documentos;
drop policy contabilidad_documentos_delete_by_club
  on public.contabilidad_documentos;

-- Los miembros, incluido viewer, pueden consultar metadatos documentales.
create policy contabilidad_documentos_select_by_club
  on public.contabilidad_documentos
  for select
  to authenticated
  using (public.can_access_club(club_id));

-- Solo owner, admin, manager o administrador global pueden crear metadatos.
create policy contabilidad_documentos_insert_by_club
  on public.contabilidad_documentos
  for insert
  to authenticated
  with check (public.can_edit_club(club_id));

-- Solo los usuarios con permiso de edición pueden modificar metadatos.
create policy contabilidad_documentos_update_by_club
  on public.contabilidad_documentos
  for update
  to authenticated
  using (public.can_edit_club(club_id))
  with check (public.can_edit_club(club_id));

-- Solo los usuarios con permiso de edición pueden borrar metadatos.
create policy contabilidad_documentos_delete_by_club
  on public.contabilidad_documentos
  for delete
  to authenticated
  using (public.can_edit_club(club_id));

commit;

-- ============================================================================
-- 5. CONSULTAS DE VERIFICACIÓN POSTERIORES
-- ============================================================================
-- Estas consultas están comentadas para que la herramienta de migraciones no
-- las interprete como parte necesaria del cambio. Deben ejecutarse manualmente
-- después de aplicar la migración.

-- Confirma que las dos funciones usan club_miembros y ya no usan user_clubs.
-- select pg_catalog.pg_get_functiondef(
--   'public.can_access_club(bigint)'::regprocedure
-- );
-- select pg_catalog.pg_get_functiondef(
--   'public.can_edit_club(bigint)'::regprocedure
-- );

-- Confirma que no quedan políticas FOR ALL en las tablas migradas.
-- select
--   policy.schemaname,
--   policy.tablename,
--   policy.policyname,
--   policy.cmd
-- from pg_catalog.pg_policies as policy
-- where policy.schemaname = 'public'
--   and policy.tablename in (
--     'bancos',
--     'checklist_justificacion',
--     'conceptos',
--     'contabilidad',
--     'entidades',
--     'imputaciones',
--     'pagos',
--     'personal',
--     'programas',
--     'proveedores',
--     'subvencion_programas',
--     'subvenciones',
--     'tipos'
--   )
--   and policy.cmd = 'ALL';
-- Resultado esperado: cero filas.

-- Lista las 60 políticas finales: cuatro para cada una de las trece tablas y
-- cuatro para cada una de las dos tablas documentales.
-- select
--   policy.tablename,
--   policy.policyname,
--   policy.cmd,
--   policy.roles,
--   policy.qual,
--   policy.with_check
-- from pg_catalog.pg_policies as policy
-- where policy.schemaname = 'public'
--   and policy.tablename in (
--     'bancos',
--     'checklist_justificacion',
--     'conceptos',
--     'contabilidad',
--     'documentos',
--     'contabilidad_documentos',
--     'entidades',
--     'imputaciones',
--     'pagos',
--     'personal',
--     'programas',
--     'proveedores',
--     'subvencion_programas',
--     'subvenciones',
--     'tipos'
--   )
-- order by policy.tablename, policy.cmd, policy.policyname;

-- Verifica mediante sesiones autenticadas reales la matriz esperada:
--   administrador global: acceso=true, edición=true para cualquier club;
--   owner/admin/manager: acceso=true y edición=true para su club;
--   viewer: acceso=true y edición=false para su club;
--   usuario ajeno: acceso=false y edición=false.
-- select
--   public.can_access_club(<club_id_de_prueba>) as puede_leer,
--   public.can_edit_club(<club_id_de_prueba>) as puede_editar;

-- ============================================================================
-- 6. ROLLBACK COMPLETO DE LA MIGRACIÓN 1
-- ============================================================================
-- El rollback está completamente comentado para impedir su ejecución durante
-- una migración normal. En caso de emergencia, copiar este bloque a una nueva
-- migración de reversión, quitar los prefijos de comentario y ejecutarlo como
-- una transacción independiente.
--
-- El rollback restaura exactamente:
--   - can_access_club basado en user_clubs;
--   - can_edit_club basado en user_clubs.club_rol = club_admin;
--   - las trece políticas FOR ALL originales;
--   - las ocho políticas documentales originales basadas en can_access_club.

-- begin;
--
-- create or replace function public.can_access_club(p_club_id bigint)
-- returns boolean
-- language sql
-- stable
-- security definer
-- set search_path = 'public'
-- as $function$
--   select
--     public.is_admin()
--     or exists (
--       select 1
--       from public.user_clubs as legacy_membership
--       where legacy_membership.user_id = auth.uid()
--         and legacy_membership.club_id = p_club_id
--     );
-- $function$;
--
-- create or replace function public.can_edit_club(p_club_id bigint)
-- returns boolean
-- language sql
-- stable
-- security definer
-- set search_path = 'public'
-- as $function$
--   select
--     public.is_admin()
--     or exists (
--       select 1
--       from public.user_clubs as legacy_membership
--       where legacy_membership.user_id = auth.uid()
--         and legacy_membership.club_id = p_club_id
--         and legacy_membership.club_rol = 'club_admin'
--     );
-- $function$;
--
-- do $rollback_split_policies$
-- declare
--   policy_config record;
-- begin
--   for policy_config in
--     select *
--     from (
--       values
--         ('bancos', 'bancos_all'),
--         ('checklist_justificacion', 'checklist_all'),
--         ('conceptos', 'conceptos_all'),
--         ('contabilidad', 'contabilidad_all'),
--         ('entidades', 'entidades_all'),
--         ('imputaciones', 'imputaciones_all'),
--         ('pagos', 'pagos_all'),
--         ('personal', 'personal_all'),
--         ('programas', 'programas_all'),
--         ('proveedores', 'proveedores_all'),
--         ('subvencion_programas', 'subvencion_programas_all'),
--         ('subvenciones', 'subvenciones_all'),
--         ('tipos', 'tipos_all')
--     ) as policies(table_name, old_policy_name)
--   loop
--     execute format(
--       'drop policy if exists %I on public.%I',
--       policy_config.table_name || '_select_by_club',
--       policy_config.table_name
--     );
--     execute format(
--       'drop policy if exists %I on public.%I',
--       policy_config.table_name || '_insert_by_club',
--       policy_config.table_name
--     );
--     execute format(
--       'drop policy if exists %I on public.%I',
--       policy_config.table_name || '_update_by_club',
--       policy_config.table_name
--     );
--     execute format(
--       'drop policy if exists %I on public.%I',
--       policy_config.table_name || '_delete_by_club',
--       policy_config.table_name
--     );
--
--     execute format(
--       'create policy %I on public.%I
--          for all
--          to authenticated
--          using (public.can_access_club(club_id))
--          with check (public.can_access_club(club_id))',
--       policy_config.old_policy_name,
--       policy_config.table_name
--     );
--   end loop;
-- end;
-- $rollback_split_policies$;
--
-- drop policy if exists documentos_select_by_club
--   on public.documentos;
-- drop policy if exists documentos_insert_by_club
--   on public.documentos;
-- drop policy if exists documentos_update_by_club
--   on public.documentos;
-- drop policy if exists documentos_delete_by_club
--   on public.documentos;
--
-- create policy documentos_select_by_club
--   on public.documentos
--   for select
--   to authenticated
--   using (public.can_access_club(club_id));
-- create policy documentos_insert_by_club
--   on public.documentos
--   for insert
--   to authenticated
--   with check (public.can_access_club(club_id));
-- create policy documentos_update_by_club
--   on public.documentos
--   for update
--   to authenticated
--   using (public.can_access_club(club_id))
--   with check (public.can_access_club(club_id));
-- create policy documentos_delete_by_club
--   on public.documentos
--   for delete
--   to authenticated
--   using (public.can_access_club(club_id));
--
-- drop policy if exists contabilidad_documentos_select_by_club
--   on public.contabilidad_documentos;
-- drop policy if exists contabilidad_documentos_insert_by_club
--   on public.contabilidad_documentos;
-- drop policy if exists contabilidad_documentos_update_by_club
--   on public.contabilidad_documentos;
-- drop policy if exists contabilidad_documentos_delete_by_club
--   on public.contabilidad_documentos;
--
-- create policy contabilidad_documentos_select_by_club
--   on public.contabilidad_documentos
--   for select
--   to authenticated
--   using (public.can_access_club(club_id));
-- create policy contabilidad_documentos_insert_by_club
--   on public.contabilidad_documentos
--   for insert
--   to authenticated
--   with check (public.can_access_club(club_id));
-- create policy contabilidad_documentos_update_by_club
--   on public.contabilidad_documentos
--   for update
--   to authenticated
--   using (public.can_access_club(club_id))
--   with check (public.can_access_club(club_id));
-- create policy contabilidad_documentos_delete_by_club
--   on public.contabilidad_documentos
--   for delete
--   to authenticated
--   using (public.can_access_club(club_id));
--
-- commit;
