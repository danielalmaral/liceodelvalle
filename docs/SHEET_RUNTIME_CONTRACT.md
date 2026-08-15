# Sheet Runtime Contract

`SheetRepository` mapea headers canonicos a objetos y soporta `getAll`, `insert`, `updateById` y `findById`.

Reglas:

- Los headers deben coincidir exactamente.
- Si el adapter expone `getLastColumn`, headers no vacíos adicionales producen `SHEET_REPOSITORY_HEADER_MISMATCH`.
- `insert` agrega al final.
- `updateById` localiza por ID estable, no por row number.
- `updateById` rechaza mutaciones del ID estable con `SHEET_REPOSITORY_IDENTITY_MUTATION`.
- Cero coincidencias produce `SHEET_REPOSITORY_NOT_FOUND`.
- Multiples coincidencias producen `SHEET_REPOSITORY_DUPLICATE_ID`.
- Lecturas devuelven copias.

Runtime:

- `createAppsScriptRuntime` requiere `spreadsheetId` desde environment adapter.
- `createAppsScriptRuntime` requiere repositorios canonicos para `CONFIG`, `ALUMNOS`, `TUTORES`, `SESIONES`, `ASISTENCIAS`, `PARTIDOS`, `CONVOCATORIAS`, `CONVOCATORIA_DETALLE`, `PARTICIPACION_PARTIDO`, `COMUNICACIONES` y `BITACORA`.
- El grafo de servicios se construye explicitamente; dependencias criticas faltantes fallan con `RUNTIME_CONFIG_DEPENDENCY_REQUIRED`.
- IDs y entorno futuro viven en Script Properties, no hardcoded.
- El lock es obligatorio. Los comandos de escritura expuestos por runtime se ejecutan bajo `runExclusive`.
- `runtime.commands` es la autoridad para writes criticos auditados: ausencias, asistencias, convocatoria final, participacion, comunicaciones y bitacora.
- Handlers disponibles: `expirePendingAbsences` y `sendPendingCommunications`.
- Los handlers usan comandos ya lockeados cuando estan disponibles para evitar doble lock.
- No se instalan triggers ni se ejecutan adapters reales en tests.

Setup global:

- Crea o valida 11 hojas operativas: `CONFIG`, `ALUMNOS`, `TUTORES`, `SESIONES`, `ASISTENCIAS`, `PARTIDOS`, `CONVOCATORIAS`, `CONVOCATORIA_DETALLE`, `PARTICIPACION_PARTIDO`, `COMUNICACIONES`, `BITACORA`.
- `PANEL` queda fuera de este batch.
