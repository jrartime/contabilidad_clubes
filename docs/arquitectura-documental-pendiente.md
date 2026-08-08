# Arquitectura documental pendiente

> Estado: evolución futura aprobada conceptualmente, pero fuera del alcance actual. No está desplegada.

## Modelo previsto

```text
documentos_contables
├── imputaciones económicas
├── pagos documentales
├── adjuntos
└── extensión especializada de nóminas
```

`documentos_contables` será la cabecera y fuente de verdad del documento. Las imputaciones económicas conservarán la distribución por programa y concepto; los pagos representarán la dimensión de caja; los adjuntos dependerán del documento; y las nóminas tendrán una especialización propia, sin forzarlas dentro del flujo documental ordinario.

## Decisiones funcionales aprobadas

- `importe_total` pertenece al documento contable.
- `importe_imputado` pertenece a cada imputación económica.
- El valor **Ejecutado** de Presupuestos continúa calculándose como `SUM(contabilidad.importe_imputado)` para los programas y conceptos incluidos.
- Pagos y Banco forman una dimensión de caja separada de la imputación contable.
- Las nóminas requieren una extensión especializada propia.
- La justificación de subvenciones constituye otra dimensión distinta y no debe confundirse con el documento, la imputación o la caja.

## Transición futura

Las fases documentales 1 y 1B deberán prepararse, auditarse y desplegarse coordinadamente. La fase 1 crea y migra la estructura documental; la fase 1B convierte esa estructura en la fuente de verdad utilizada por la aplicación. Desplegar solo una de ellas dejaría una ventana en la que el código anterior podría seguir escribiendo campos heredados de forma divergente.

El diseño analizado para la fase 1B contemplaba:

- RPCs PostgreSQL atómicas para crear, editar, duplicar y eliminar documentos e imputaciones sin estados parciales;
- sincronización unidireccional desde `documentos_contables` hacia los campos documentales heredados de `contabilidad`, únicamente como compatibilidad temporal;
- un guard que rechazase escrituras directas divergentes en esos campos heredados;
- comprobaciones de permisos y aislamiento por club tanto en servidor como en PostgreSQL;
- una estrategia explícita para documentos compartidos por varias imputaciones.

Esta transición se ha pospuesto deliberadamente. No debe implementarse parcialmente ni recuperarse el SQL borrador directamente en `supabase/migrations/`.

## Borrador conservado

El SQL exploratorio de la fase 1 se conserva en `docs/database-drafts/documentos_contables_fase_1_NO_APLICAR.sql` solo como documentación técnica. Antes de volver a incorporarlo al circuito de migraciones será obligatoria una nueva auditoría del esquema, de los datos reales, de las dependencias y del código vigente; deberá generarse una migración nueva con una versión nueva.
