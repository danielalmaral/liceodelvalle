# Panel Contract

P14 agrega `PANEL` como interfaz operativa para el piloto. El panel no es fuente de verdad y se despliega como sidebar HtmlService en Apps Script container-bound al Spreadsheet.

## Autoridad

- Los datos autoritativos viven en hojas canonicas y servicios de dominio.
- El panel lee mediante `runtime.queries`.
- Todo write usa handler servidor y `runtime.commands`.
- Ningun handler de mutacion accede a repositories o servicios mutables.
- El cliente no provee `operationId` autoritativo; el servidor lo genera.

## Vistas

- Dashboard: sesiones abiertas, proxima sesion, asistencia, faltas, partidos, convocatorias, comunicaciones y alertas.
- Asistencia: alumnos de una sesion, estado actual y capacidades de captura/resolucion.
- Convocatorias: snapshots persistidos de elegibilidad, ranking, seleccion final y cambios manuales.
- Participacion: convocados finales, estadistica post-partido, readiness y alertas existentes.

## UI

La UI usa HtmlService sin framework, CDN ni librerias externas. La hoja `PANEL` solo contiene layout/branding/ayuda. La sidebar principal se llama `Liceo del Valle - Futbol` y se abre con `SpreadsheetApp.getUi().showSidebar(...)` desde el Spreadsheet container.

## Privacidad

El panel no muestra contactos de tutores, justificaciones completas, cuerpos de mensaje, bitacora raw ni stack traces. Los errores se devuelven como `{ ok, code, message, data }` con mensaje seguro.
