# Historial de cambios

## 2026-07-29

### Banco

- Añadido un buscador global sobre todos los campos mostrados.
- La búsqueda ignora mayúsculas y acentos y admite varios términos.
- Generalizada la asignación masiva mediante selección de campo y nuevo valor.
- Añadida selección individual y selección de todas las filas visibles desde la cabecera.
- Añadida duplicación desde el panel de edición.
- El original se guarda antes de crear la copia.
- Los movimientos duplicados quedan enlazados mediante referencias cruzadas en `referencia_1`.
- Añadida una etiqueta visual bajo la fecha con el identificador relacionado en su ayuda emergente.
- Añadido el resumen de ejecución cuando se filtra por un programa.

### Nóminas

- Añadidos totales al resumen mensual filtrado.
- Añadido orden independiente por todas las cabeceras del resumen mensual.
- Añadido el resumen de ejecución cuando se filtra por un programa.

### Contabilidad

- La vista predeterminada del listado pasa a ser de lectura.
- Añadido un botón para activar o desactivar la edición tipo Excel.
- Conservadas las acciones de edición desde el listado.
- Movida la duplicación al panel lateral, junto a Guardar y Salir.
- Sustituida la selección convencional de documentos por una zona de arrastrar y soltar.

### Componentes compartidos

- `SubsidyExecutionSummary`: presentación común del estado de una subvención.
- `FileDropUpload`: carga múltiple mediante arrastrar y soltar o selección por clic.
- `getSubsidyExecutionTotals`: cálculo común de ingresos y ejecución por programa.

### Verificación

- ESLint sin errores.
- Compilación de producción y comprobación TypeScript correctas.
