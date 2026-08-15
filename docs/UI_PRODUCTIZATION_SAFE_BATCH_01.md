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

