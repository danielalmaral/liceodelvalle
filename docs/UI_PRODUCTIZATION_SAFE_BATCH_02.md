# UI Productization Safe Batch 02

## Rutas Implementadas

- `matches`: calendario operativo, filtros, alta, edicion de partidos programados, marcar jugado y cancelar.
- `postmatch`: captura de participacion posterior al partido desde asistencia canonica.
- `reports`: consulta de resumen deportivo, metricas de asistencia y participacion.
- `communications`: monitor seguro de comunicaciones, envio pendiente y reintento gobernados por capability runtime.
- `config`: consulta read-only de CONFIG runtime.

Con esto la web app full-screen tiene implementadas todas las rutas del piloto:
`dashboard`, `students`, `attendance`, `convocations`, `matches`, `postmatch`, `reports`, `communications` y `config`.

## RPC y Read Models

Se agregaron read models seguros en `PanelHandlers`:

- `getAppMatches()`
- `getAppReports()`
- `getAppCommunications()`
- `getAppConfiguration()`

Todos responden mediante `safePanelResponse` y `toPanelSerializable`. `getPanelParticipation(matchId)` permanece como fuente canonica del detalle Post Partido. RuntimeComposition expone `queries.getConfigEntries()` solo para lectura mediante `configService.getAll()`.

## PII Boundary

La app muestra nombre de alumno cuando es necesario para operar. No expone tutores, correos, telefonos, destinatarios, asunto, cuerpo de mensajes, Google IDs, Spreadsheet IDs, Script IDs, Script Properties ni valores raw de auditoria.

Comunicaciones devuelve solo datos operativos seguros: id de comunicacion, tipo, alumno, competencia, referencia, fechas, estado, intentos, codigo seguro y elegibilidad de retry.

## Filtros

El filtro global `Todas / Liga A / Liga B` sigue siendo de presentacion y ahora aplica a Partidos, Post Partido, Reportes y Comunicaciones. Cada modulo mantiene filtros locales separados:

- Partidos: busqueda, competencia local y estado.
- Reportes: jugador, nivel y posicion.
- Comunicaciones: tipo, estado y busqueda por alumno o referencia.

CONFIG no se filtra por liga porque contiene reglas globales agrupadas.

## Async Interlocks

Las rutas nuevas usan epoch/contexto de ruta para ignorar successes y failures obsoletos. Los cambios de partido en Post Partido limpian filas previas inmediatamente. Las escrituras capturan ruta y entidad de origen para evitar que una respuesta tardia cambie seleccion, rehidrate otra pantalla o muestre errores fuera de contexto.

Flags separados controlan doble submit:

- `matchWritePending`
- `participationWriteByStudent`
- `communicationWritePending`
- `communicationRetryPendingById`

## Communications Safety

Si `runtimeCapabilities.externalMailEnabled !== true`, la UI muestra envio externo deshabilitado y bloquea envio/reintento desde el controller. La UI nunca llama `MailApp` ni `GmailApp`; solo usa los commands canonicos `commandSendPendingCommunications` y `commandRetryCommunication`.

Errores no canonicos se reducen a `SEND_ERROR`; `DELIVERY_ATTEMPT_IN_PROGRESS` se conserva como codigo seguro y bloquea retry por incertidumbre.

## CONFIG Read-Only

Configuracion operativa queda solo lectura durante este piloto. La pantalla muestra estado, total de claves runtime, capability de mail externo y grupos reales desde data runtime.

No se agrega `updateConfig`, `setConfig`, `saveConfig`, toggle editable ni mutacion directa de Sheets.

## Deferreds

- `BRAND_OFFICIAL_LOGO_ASSET_PENDING`
- `CONVOCATION_PDF_EXPORT`
- `REPORT_EXPORT_PENDING`
- `CONFIG_WRITE_UI_GOVERNANCE_PENDING`

No se agregan exportes PDF/CSV/Excel ni escritura de CONFIG en este batch.
