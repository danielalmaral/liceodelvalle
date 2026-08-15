# Apps Script Bootstrap Contract

P14 prepara adapters reales para Apps Script container-bound sin ejecutar Google real durante desarrollo local.

## Environment

`AppsScriptEnvironmentAdapter` lee Script Properties de forma lazy.

- `LDV_SPREADSHEET_ID` es obligatorio para crear runtime.
- `LDV_EXTERNAL_MAIL_ENABLED` debe ser `TRUE` para permitir correo externo.
- Cualquier otro valor mantiene correo deshabilitado.
- En despliegue P15, el Apps Script está ligado al Spreadsheet de smoke; `clasp` debe apuntar al `scriptId` de ese contenedor.

## Lock

`AppsScriptLockAdapter.runExclusive(callback)` adquiere lock, ejecuta el callback y libera en `finally`. Si no obtiene lock, falla con `RUNTIME_LOCK_ACQUISITION_FAILED`.

## Repositories

`AppsScriptRepositoryFactory` abre el Spreadsheet por ID y exige que cada hoja canonica exista. Si falta una hoja, falla con `SHEET_REQUIRED`. El setup explicito es el unico responsable de crear hojas.

## IDs

`AppsScriptIdGenerator` usa UUID lazy y prefijos estables: `ALU-`, `TUT-`, `SES-`, `AST-`, `PAR-`, `CON-`, `DET-`, `PRT-`, `COM-`, `AUD-`, `OP-`.

## Runtime

`createLdvAppsScriptRuntime()` compone environment, lock, repositories, id generator, mail guard y runtime. No debe ejecutarse al cargar archivo. Ningun adapter real se invoca durante bootstrap salvo cuando un handler solicita runtime.

La UI del panel se abre con `SpreadsheetApp.getUi().showSidebar(...)` desde el contenedor del Spreadsheet. No hay otro target de publicación para P15.
