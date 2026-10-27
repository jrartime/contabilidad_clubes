-- Entidad financiadora de la parte no subvencionada de cada gasto, para
-- poder generar la Justificación B (6.3 Declaración responsable de
-- cofinanciación) del Anexo III de justificación de subvenciones.

begin;

alter table public.contabilidad
  add column if not exists entidad_financiadora_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contabilidad_entidad_financiadora_id_fkey'
  ) then
    alter table public.contabilidad
      add constraint contabilidad_entidad_financiadora_id_fkey
      foreign key (entidad_financiadora_id)
      references public.entidades (id_entidad);
  end if;
end $$;

commit;
