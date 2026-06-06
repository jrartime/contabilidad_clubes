-- Añade columna activo a proveedores para soporte de baja lógica (soft delete).
-- Los proveedores dados de baja no aparecen en los controles de la app,
-- pero se conservan en el histórico de contabilidad.

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- Índice para acelerar el filtro activo=true (el más habitual)
CREATE INDEX IF NOT EXISTS idx_proveedores_club_activo
  ON proveedores (club_id, activo);

COMMENT ON COLUMN proveedores.activo IS
  'false = dado de baja; no aparece en selects pero se conserva en el historial contable.';
