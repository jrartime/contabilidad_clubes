alter table public.programas
  add column if not exists tipo_programa text not null default 'clubes';

-- Clasificación inicial de los programas ya existentes. El valor se puede
-- revisar y modificar posteriormente desde Configuración > Programas.
update public.programas
set tipo_programa = case
  when programa ilike '%EEDD%' or programa ilike '%CTD%'
    then 'eedd_ctd_discapacidad'
  when programa ilike '%Open%'
    then 'eventos'
  when programa ilike '%Gastos Club%'
    then 'clubes'
  else tipo_programa
end
where programa ilike '%EEDD%'
   or programa ilike '%CTD%'
   or programa ilike '%Open%'
   or programa ilike '%Gastos Club%';

alter table public.programas
  drop constraint if exists programas_tipo_programa_check;

alter table public.programas
  add constraint programas_tipo_programa_check
  check (tipo_programa in ('clubes', 'eventos', 'eedd_ctd_discapacidad'));

comment on column public.programas.tipo_programa is
  'Clasificación regulatoria utilizada para limitar los conceptos justificativos.';
