# Control económico de clubes

Aplicación para gestionar contabilidad, nóminas, movimientos bancarios, subvenciones y conciliación por club. Está construida con Next.js, React, TypeScript y Supabase.

## Funcionalidad

- Autenticación y selección de club activo.
- Separación de datos por club mediante permisos y políticas RLS.
- Contabilidad con filtros, exportaciones, documentos y edición tipo Excel.
- Nóminas con importación de costes, informes PDF y resumen mensual.
- Banco con importación Excel, búsqueda global y asignación masiva.
- Conciliación bancaria manual 1 a 1.
- Gestión de personal, proveedores, programas, conceptos, miembros y roles.
- Seguimiento de la ejecución de subvenciones.

## Flujos principales

### Contabilidad

El listado se muestra en modo lectura de forma predeterminada. El botón **Modo edición (Excel)** activa la edición directa de las filas.

Cada asiento puede abrirse en un panel lateral. Desde el panel se puede:

- Guardar el asiento.
- Duplicarlo y abrir la copia para editar.
- Arrastrar y soltar documentos, o seleccionarlos pulsando la zona de carga.
- Descargar o eliminar documentos.
- Eliminar el asiento y sus documentos.

Los documentos admitidos son PDF, JPG y PNG, con un máximo de 1 MB por archivo.

### Banco

El buscador global filtra sobre fechas, texto, referencias, importes, saldo, orden, programa y concepto. No distingue mayúsculas ni acentos y admite varias palabras.

La asignación masiva permite:

1. Activar el modo de asignación.
2. Marcar filas individualmente o seleccionar todas las visibles desde la cabecera.
3. Elegir cualquier campo bancario permitido.
4. Asignar el nuevo valor a los movimientos seleccionados.

Desde el panel de edición se puede guardar y duplicar un movimiento. El original y la copia quedan enlazados mediante `referencia_1`, y ambos muestran una etiqueta **Duplicado** bajo la fecha.

### Nóminas

El resumen mensual trabaja sobre las nóminas filtradas. Todas sus cabeceras son ordenables y la fila final muestra los totales de nóminas, bruto, coste empresarial, Seguridad Social, total e imputado.

### Ejecución de subvenciones

Al filtrar por un programa concreto en Contabilidad, Banco o Nóminas se muestra:

- Subvención concedida.
- Ingresos bancarios.
- Importe ejecutado.
- Importe pendiente.
- Porcentaje de ejecución.
- Fecha límite.

## Tecnologías

- Next.js 16
- React 19
- TypeScript
- Supabase Auth, PostgreSQL y Storage
- ESLint

## Desarrollo

```bash
npm install
npm run dev
```

Variables requeridas en `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

No debe subirse `.env.local` al repositorio.

## Verificación

```bash
npm run lint
npm run build
```

## Tipos de Supabase

Para generar los tipos TypeScript desde el proyecto remoto:

```powershell
$env:SUPABASE_ACCESS_TOKEN="tu-token"
npm run supabase:types
```

El resultado se genera en `src/lib/supabase/database.types.ts`. El token debe mantenerse únicamente como variable de entorno local.

## Base de datos

Las migraciones y auditorías están en `database/`. El estado y los pendientes de normalización se describen en `database/NORMALIZATION.md`.

## Historial

Las entregas funcionales relevantes se documentan en [CHANGELOG.md](CHANGELOG.md).
