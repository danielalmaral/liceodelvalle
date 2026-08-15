# Sheet Runtime Contract

`SheetRepository` mapea headers canonicos a objetos y soporta `getAll`, `insert`, `updateById` y `findById`.

Reglas:

- Los headers deben coincidir exactamente.
- `insert` agrega al final.
- `updateById` localiza por ID estable, no por row number.
- Cero coincidencias produce `SHEET_REPOSITORY_NOT_FOUND`.
- Multiples coincidencias producen `SHEET_REPOSITORY_DUPLICATE_ID`.
- Lecturas devuelven copias.

Runtime:

- `createAppsScriptRuntime` requiere `spreadsheetId` desde environment adapter.
- IDs y entorno futuro viven en Script Properties, no hardcoded.
- Locks se inyectan para writes criticos.
- Handlers disponibles: `expirePendingAbsences` y `sendPendingCommunications`.
- No se instalan triggers ni se ejecutan adapters reales en tests.

Setup global:

- Crea o valida 11 hojas operativas: `CONFIG`, `ALUMNOS`, `TUTORES`, `SESIONES`, `ASISTENCIAS`, `PARTIDOS`, `CONVOCATORIAS`, `CONVOCATORIA_DETALLE`, `PARTICIPACION_PARTIDO`, `COMUNICACIONES`, `BITACORA`.
- `PANEL` queda fuera de este batch.
