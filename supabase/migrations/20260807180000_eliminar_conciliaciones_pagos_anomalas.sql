-- Corrige exclusivamente las dos conciliaciones de pagos identificadas como
-- anómalas durante la auditoría manual. Esta migración no modifica asientos,
-- movimientos bancarios, esquema, funciones, triggers ni políticas RLS.
BEGIN;

DO $payment_data_correction$
DECLARE
  -- Cada registro se carga completo y se bloquea para impedir que otra sesión
  -- lo modifique entre la comprobación de seguridad y el borrado o el COMMIT.
  v_pago_1 public.pagos%ROWTYPE;
  v_pago_32 public.pagos%ROWTYPE;
  v_pago_93 public.pagos%ROWTYPE;
  v_pago_94 public.pagos%ROWTYPE;
  v_deleted_count integer;
BEGIN
  -- Bloquea la primera conciliación anómala y aborta si ya no existe.
  SELECT *
    INTO v_pago_1
    FROM public.pagos
   WHERE id_pago = 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Corrección cancelada: ya no existe pagos.id_pago = 1.';
  END IF;

  -- Comprueba de forma NULL-safe que la fila 1 conserva exactamente todos los
  -- valores auditados. Así se evita borrar una relación modificada entretanto.
  IF v_pago_1.club_id IS DISTINCT FROM 1::bigint
     OR v_pago_1.contabilidad_id IS DISTINCT FROM 123::bigint
     OR v_pago_1.banco_id IS DISTINCT FROM 456::bigint
     OR v_pago_1.fecha_pago_real IS DISTINCT FROM DATE '2025-03-10'
     OR v_pago_1.importe_pagado IS DISTINCT FROM 250.00::numeric
     OR v_pago_1.metodo IS DISTINCT FROM 'transferencia'::text
     OR v_pago_1.observaciones IS DISTINCT FROM NULL::text
     OR v_pago_1.created_at IS DISTINCT FROM TIMESTAMPTZ '2026-01-15 08:35:37.742857+00' THEN
    RAISE EXCEPTION
      'Corrección cancelada: pagos.id_pago = 1 ha cambiado desde la auditoría.';
  END IF;

  -- Bloquea la segunda conciliación anómala y aborta si ya no existe.
  SELECT *
    INTO v_pago_32
    FROM public.pagos
   WHERE id_pago = 32
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Corrección cancelada: ya no existe pagos.id_pago = 32.';
  END IF;

  -- Comprueba de forma NULL-safe que la fila 32 continúa siendo exactamente
  -- la conciliación automática incorrecta localizada durante la auditoría.
  IF v_pago_32.club_id IS DISTINCT FROM 1::bigint
     OR v_pago_32.contabilidad_id IS DISTINCT FROM 150::bigint
     OR v_pago_32.banco_id IS DISTINCT FROM 1075::bigint
     OR v_pago_32.fecha_pago_real IS DISTINCT FROM DATE '2024-02-14'
     OR v_pago_32.importe_pagado IS DISTINCT FROM 40.00::numeric
     OR v_pago_32.metodo IS DISTINCT FROM 'transferencia'::text
     OR v_pago_32.observaciones IS DISTINCT FROM 'Conciliación automática 1a1'::text
     OR v_pago_32.created_at IS DISTINCT FROM TIMESTAMPTZ '2026-01-15 08:58:17.180214+00' THEN
    RAISE EXCEPTION
      'Corrección cancelada: pagos.id_pago = 32 ha cambiado desde la auditoría.';
  END IF;

  -- Bloquea y captura la primera asignación válida del pago agrupado. No se
  -- elimina: el bloqueo garantiza que siga intacta hasta terminar la operación.
  SELECT *
    INTO v_pago_93
    FROM public.pagos
   WHERE id_pago = 93
   FOR UPDATE;

  IF NOT FOUND
     OR v_pago_93.club_id IS DISTINCT FROM 1::bigint
     OR v_pago_93.contabilidad_id IS DISTINCT FROM 473::bigint
     OR v_pago_93.banco_id IS DISTINCT FROM 69::bigint
     OR v_pago_93.fecha_pago_real IS DISTINCT FROM DATE '2023-01-13'
     OR v_pago_93.importe_pagado IS DISTINCT FROM 2680.00::numeric
     OR v_pago_93.metodo IS DISTINCT FROM 'transferencia'::text
     OR v_pago_93.observaciones IS DISTINCT FROM 'Pago agrupado: factura partida por programas'::text
     OR v_pago_93.created_at IS DISTINCT FROM TIMESTAMPTZ '2026-01-15 10:31:42.490242+00' THEN
    RAISE EXCEPTION
      'Corrección cancelada: pagos.id_pago = 93 ya no coincide con la asignación válida auditada.';
  END IF;

  -- Bloquea y captura la segunda asignación válida del pago agrupado. Junto con
  -- la fila 93 acredita el reparto 2.680 + 580 = 3.260 euros.
  SELECT *
    INTO v_pago_94
    FROM public.pagos
   WHERE id_pago = 94
   FOR UPDATE;

  IF NOT FOUND
     OR v_pago_94.club_id IS DISTINCT FROM 1::bigint
     OR v_pago_94.contabilidad_id IS DISTINCT FROM 474::bigint
     OR v_pago_94.banco_id IS DISTINCT FROM 69::bigint
     OR v_pago_94.fecha_pago_real IS DISTINCT FROM DATE '2023-01-13'
     OR v_pago_94.importe_pagado IS DISTINCT FROM 580.00::numeric
     OR v_pago_94.metodo IS DISTINCT FROM 'transferencia'::text
     OR v_pago_94.observaciones IS DISTINCT FROM 'Pago agrupado: factura partida por programas'::text
     OR v_pago_94.created_at IS DISTINCT FROM TIMESTAMPTZ '2026-01-15 10:31:42.490242+00' THEN
    RAISE EXCEPTION
      'Corrección cancelada: pagos.id_pago = 94 ya no coincide con la asignación válida auditada.';
  END IF;

  -- Elimina solamente las dos relaciones declaradas anómalas. El filtro cerrado
  -- impide que la corrección pueda afectar a cualquier otra fila de pagos.
  DELETE FROM public.pagos
   WHERE id_pago IN (1, 32);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Exige que el borrado haya afectado exactamente a las dos filas previstas.
  -- Cualquier desviación aborta y revierte automáticamente toda la transacción.
  IF v_deleted_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION
      'Corrección cancelada: se esperaban 2 eliminaciones y se produjeron %.',
      v_deleted_count;
  END IF;

  -- Verifica inmediatamente antes del COMMIT que las filas anómalas han dejado
  -- de existir y que las dos asignaciones válidas continúan sin alteraciones.
  IF EXISTS (
    SELECT 1 FROM public.pagos WHERE id_pago IN (1, 32)
  ) THEN
    RAISE EXCEPTION
      'Corrección cancelada: alguna conciliación anómala continúa presente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.pagos
     WHERE id_pago = 93
       AND club_id = 1
       AND contabilidad_id = 473
       AND banco_id = 69
       AND fecha_pago_real = DATE '2023-01-13'
       AND importe_pagado = 2680.00::numeric
       AND metodo = 'transferencia'
       AND observaciones = 'Pago agrupado: factura partida por programas'
       AND created_at = TIMESTAMPTZ '2026-01-15 10:31:42.490242+00'
  ) OR NOT EXISTS (
    SELECT 1
      FROM public.pagos
     WHERE id_pago = 94
       AND club_id = 1
       AND contabilidad_id = 474
       AND banco_id = 69
       AND fecha_pago_real = DATE '2023-01-13'
       AND importe_pagado = 580.00::numeric
       AND metodo = 'transferencia'
       AND observaciones = 'Pago agrupado: factura partida por programas'
       AND created_at = TIMESTAMPTZ '2026-01-15 10:31:42.490242+00'
  ) THEN
    RAISE EXCEPTION
      'Corrección cancelada: pagos.id_pago 93 o 94 no permanece intacto.';
  END IF;
END;
$payment_data_correction$;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN POSTERIOR DE SOLO LECTURA
-- ---------------------------------------------------------------------------
-- Debe devolver cero filas: las relaciones incorrectas ya no existen.
-- SELECT *
-- FROM public.pagos
-- WHERE id_pago IN (1, 32);

-- Debe devolver exactamente las filas 93 y 94, con 2.680 y 580 euros.
-- SELECT id_pago, club_id, contabilidad_id, banco_id, fecha_pago_real,
--        importe_pagado, metodo, observaciones, created_at
-- FROM public.pagos
-- WHERE id_pago IN (93, 94)
-- ORDER BY id_pago;

-- Los asientos y movimientos quedan disponibles para revisión manual. Esta
-- consulta debe mostrar los asientos 123/150 y los bancos 456/1000/1075/1124;
-- la migración no modifica ninguna de esas filas.
-- SELECT 'contabilidad' AS origen, id_contabilidad AS id
-- FROM public.contabilidad
-- WHERE id_contabilidad IN (123, 150)
-- UNION ALL
-- SELECT 'bancos' AS origen, id_banco AS id
-- FROM public.bancos
-- WHERE id_banco IN (456, 1000, 1075, 1124)
-- ORDER BY origen, id;

-- ---------------------------------------------------------------------------
-- ROLLBACK MANUAL POSTERIOR AL COMMIT (NO FORMA PARTE DE LA EJECUCIÓN)
-- ---------------------------------------------------------------------------
-- Si la migración todavía no se ha confirmado, basta con sustituir COMMIT por
-- ROLLBACK. Si ya se confirmó y fuera imprescindible revertirla, ejecutar el
-- bloque siguiente por separado tras comprobar que los ID siguen libres.
--
-- BEGIN;
--
-- INSERT INTO public.pagos (
--   id_pago, club_id, contabilidad_id, banco_id, fecha_pago_real,
--   importe_pagado, metodo, observaciones, created_at
-- ) VALUES
--   (
--     1, 1, 123, 456, DATE '2025-03-10', 250.00,
--     'transferencia', NULL, TIMESTAMPTZ '2026-01-15 08:35:37.742857+00'
--   ),
--   (
--     32, 1, 150, 1075, DATE '2024-02-14', 40.00,
--     'transferencia', 'Conciliación automática 1a1',
--     TIMESTAMPTZ '2026-01-15 08:58:17.180214+00'
--   );
--
-- COMMIT;
