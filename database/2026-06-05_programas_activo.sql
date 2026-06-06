-- Añade columna activo a programas para soporte de baja lógica.
-- Los programas dados de baja no aparecen en los controles ni cargan
-- sus asientos/movimientos en contabilidad y banco.

ALTER TABLE programas
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_programas_club_activo
  ON programas (club_id, activo);

COMMENT ON COLUMN programas.activo IS
  'false = programa cerrado/dado de baja; sus asientos y movimientos no cargan en contabilidad/banco.';
