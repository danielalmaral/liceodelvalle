# Communication Contract

`COMUNICACIONES` persiste mensajes operativos sin enviar correo durante tests o batch.

Columnas: `COMUNICACION_ID`, `TIPO`, `ALUMNO_ID`, `TUTOR_ID`, `REFERENCIA_ID`, `DESTINATARIO`, `ASUNTO`, `CUERPO`, `CREADO_EN`, `ENVIADO_EN`, `ESTADO`, `ERROR`, `INTENTOS`.

Tipos: `AUSENCIA`, `CONVOCATORIA`.

Estados: `PENDIENTE`, `ENVIADO`, `ERROR`.

Reglas:

- Idempotencia por `TIPO + REFERENCIA_ID + ALUMNO_ID + TUTOR_ID`.
- Ausencias generan texto neutral; no etiquetan una falta como injustificada antes de resolverla.
- Convocatorias sólo se generan para `APROBADA` y alumnos seleccionados.
- No hay confirmación de padres ni links de confirmación.
- El dominio usa adapter `send(message)`; no llama MailApp/GmailApp directamente.
- Errores de envío se sanitizan antes de persistir.
- `ASISTENCIAS.COMUNICACION_ID` es puntero resumen legacy; la relación canónica es `COMUNICACIONES.REFERENCIA_ID`.
