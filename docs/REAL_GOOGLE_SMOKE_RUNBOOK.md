# Real Google Smoke Runbook

Este runbook documenta P15. No se ejecuta en P14.

## Preparacion

1. Crear un Spreadsheet exclusivo de pruebas.
2. Usar datos cien por ciento ficticios.
3. Crear un proyecto Apps Script standalone.
4. Configurar Script Properties:
   - `LDV_SPREADSHEET_ID`
   - `LDV_EXTERNAL_MAIL_ENABLED=FALSE`
5. Mantener correo externo deshabilitado.

## Ejecucion Controlada

1. Hacer `clasp push` controlado desde revision certificada.
2. Ejecutar setup explicito para crear las 12 hojas estructurales.
3. Poblar manualmente las 25 filas requeridas de `CONFIG` con datos ficticios persistidos.
4. Usar `TEMPORADA=P15_SMOKE` solamente para este smoke ficticio.
5. Ejecutar la verificacion de CONFIG (`verifyConfigReady` / equivalente) y confirmar resultado listo.
6. Abrir `PANEL` solo despues de que CONFIG este listo.
7. Ejecutar flujo sintetico de asistencia, convocatoria y post-partido.
8. Preparar comunicaciones sin envio real.
9. Revisar `BITACORA`.
10. Revisar errores de Apps Script.
11. No instalar triggers.
12. No enviar email.

## Evidencia Requerida

- Captura o registro de estructura de 12 hojas.
- Resultado de setup idempotente.
- Evidencia de panel abierto.
- Bitacora sin texto sensible.
- Comunicaciones sin envio externo.
- Registro de rollback o borrado del Spreadsheet de pruebas.
