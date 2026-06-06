# Normalizacion de esquema Supabase

Objetivo: llevar el esquema a convenciones PostgreSQL/Supabase sin romper la app ni perder datos.

## Convencion objetivo

- Tablas y columnas en `lower_snake_case`.
- Cada tabla de negocio que pertenece a un club debe tener `club_id`.
- Las claves foraneas deben existir como constraints reales, no solo como columnas numericas.
- Indices en columnas usadas para filtros frecuentes: `club_id`, fechas, claves foraneas.
- RLS activado en tablas con datos de usuario/club.
- Migraciones pequenas, una por dominio funcional.

## Orden seguro

1. Inventariar el esquema con `2026-06-03_schema_inventory.sql`.
2. Corregir pertenencia por club en tablas de negocio.
3. Anadir claves foraneas e indices faltantes.
4. Crear vistas de compatibilidad si se decide renombrar columnas usadas por la app.
5. Cambiar el codigo por modulo.
6. Solo al final retirar columnas/vistas antiguas.

## Estado aplicado

- `personal.club_id` creado con `2026-06-03_normalize_personal_club_id.sql`.
- La app vuelve a filtrar `personal` por club activo.
- RLS de documentos, personal y tablas de negocio normalizado hacia `authenticated`.
- FKs de `documentos` hacia `clubes`, `contabilidad`, `personal` y `programas`.
- FK de `documentos.nomina_id` hacia `contabilidad(id_contabilidad)` aplicada.
- Inventario de columnas `_id` sin FK queda limpio para tablas base no staging.

## Pendientes probables

- Revisar si `programas`, `conceptos`, `entidades`, `categorias` son globales o por club.
- Revisar la convivencia entre `documentos` y `contabilidad_documentos`.
- Revisar politicas redundantes que sigan solapadas tras endurecer RLS.
- Usar `2026-06-03_fk_candidates.sql` para preparar la siguiente migracion de foreign keys.
- Generar tipos Supabase cuando exista `SUPABASE_ACCESS_TOKEN`.
