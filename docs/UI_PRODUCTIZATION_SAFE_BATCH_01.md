# UI Productization Safe Batch 01

## Arquitectura

La interfaz final se agrega como una web app HTMLService separada del panel tecnico. La ruta `doGet()` sirve `getLdvAppHtml()` y no usa `SpreadsheetApp.getUi().showSidebar(...)`.

Flujo:

Google Sheets -> repositorios -> servicios/runtime -> `PanelHandlers` -> safe RPC boundary -> full-screen Apps Script web app.

## Routes

- `dashboard`: implementado.
- `students`: implementado.
- `attendance`: implementado.
- `convocations`: implementado.
- `matches`: scaffold.
- `postmatch`: scaffold.
- `reports`: scaffold.
- `communications`: scaffold.
- `config`: scaffold.

## RPC Reutilizados

La app reutiliza `getAppBootstrap`, `getPanelAttendance`, `getPanelConvocation`, `commandCreateAttendance`, `commandResolveAbsence`, `commandGenerateConvocation`, `commandSetFinalSelection`, `commandAssignPosition`, `commandApproveConvocation`, `commandPrepareConvocationCommunications` y `commandSendPendingCommunications`.

## Visual Design System

La UI usa variables CSS `--ldv-*`, sidebar azul marino, area principal clara, tarjetas KPI, tablas amplias, filtros, badges de estado y acciones primarias azules. No agrega frameworks, CDNs, fuentes externas ni dependencias npm.

## PII Boundary

`getAppBootstrap()` devuelve dashboard, referenceData y alumnos minimizados. No expone tutores, correos, telefonos, Script Properties, Google IDs ni bitacora completa. Los nombres de alumnos solo provienen del runtime.

## Deferred

- `BRAND_OFFICIAL_LOGO_ASSET_PENDING`
- `CONVOCATION_PDF_EXPORT`
- `PARTIDOS_FINAL_UI`
- `POSTMATCH_FINAL_UI`
- `REPORTES_FINAL_UI`
- `COMUNICACIONES_FINAL_UI`
- `CONFIGURACION_FINAL_UI`

## Known Limitations

Partidos, Post Partido, Reportes, Comunicaciones y Configuracion quedan preparados para el siguiente safe batch. El logo oficial queda pendiente de asset autorizado en repo.

## Corrective 01

La auditoria externa detecto defectos de cierre funcional en hidratacion de rutas, proteccion contra respuestas obsoletas, filtros de convocatorias, cobertura de posiciones y gating de acciones.

El correctivo mantiene el alcance del safe batch y no toca motor deportivo, repositorios, CONFIG, despliegue Google ni recursos P15. La app ahora hidrata automaticamente Asistencias y Convocatorias al entrar a la ruta, protege respuestas tardias por route/request epoch, bloquea doble click de generacion, refresca bootstrap despues de generar y deriva stepper/acciones exclusivamente del estado canonico de la convocatoria.

Los filtros de Convocatorias usan `state.convocationFilters` y atributos `data-convocation-filter`, separados de `state.studentFilters`. La cobertura de posiciones usa snapshots de convocatoria `MIN_PORTEROS_SNAPSHOT`, `MIN_DEFENSAS_SNAPSHOT`, `MIN_MEDIOS_SNAPSHOT` y `MIN_DELANTEROS_SNAPSHOT`.

## Corrective 02

El segundo correctivo cierra consistencia de seleccion y fallos obsoletos. El cambio de partido programado queda bajo autoridad del controller con `selectProgrammedMatch(matchId)`, limpiando convocatoria anterior cuando el nuevo partido no tiene propuesta y cargando la convocatoria exacta cuando existe.

El selector global de competencia queda bajo `setCompetition(value)`, con valores permitidos `ALL`, `A` y `B`; al cambiar rehidrata la ruta activa y descarta selecciones incompatibles. Los fallos stale de bootstrap, asistencia y convocatoria se ignoran simetricamente a los successes stale, y los KPI de convocatoria se calculan desde la convocatoria completa, no desde la tabla filtrada.

## Corrective 03

El tercer correctivo cierra carreras de transicion UI sin ampliar producto. El cambio humano de partido limpia inmediatamente la convocatoria anterior antes de solicitar la nueva, y el renderer bloquea detalles y acciones cuando la convocatoria cargada no corresponde al partido seleccionado.

El cambio humano de sesion de asistencia queda bajo `selectAttendanceSession(sessionId)`, que limpia filas anteriores durante el RPC y evita acciones sobre alumnos de otra sesion. La respuesta de `generateConvocation(matchId)` libera siempre el pending del intento, pero solo rehidrata Convocatorias o muestra errores si el usuario sigue en la misma ruta y partido.

## Corrective 04

El cuarto correctivo cierra seguridad de contexto para respuestas de escritura. Las operaciones de asistencia, resolucion de falta, seleccion manual, posicion, aprobacion y preparacion de comunicaciones solo refrescan o muestran errores si el usuario sigue en la misma entidad visible donde inicio la accion.

`loadConvocation(convocationId)` valida la pertenencia de la convocatoria contra el partido seleccionado usando datos de referencia, y los renderers de Asistencia y Convocatorias requieren matching estricto antes de exponer filas, detalles o acciones interactivas.
