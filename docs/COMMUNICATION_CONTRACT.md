# Communication Contract

`COMUNICACIONES` persiste mensajes operativos sin enviar correo durante tests o batch.

Columnas: `COMUNICACION_ID`, `TIPO`, `ALUMNO_ID`, `TUTOR_ID`, `REFERENCIA_ID`, `DESTINATARIO`, `ASUNTO`, `CUERPO`, `CREADO_EN`, `ENVIADO_EN`, `ESTADO`, `ERROR`, `INTENTOS`.

Tipos: `AUSENCIA`, `CONVOCATORIA`.

Estados: `PENDIENTE`, `ENVIADO`, `ERROR`.

Reglas:

- Idempotencia por `TIPO + REFERENCIA_ID + ALUMNO_ID + TUTOR_ID`.
- La unicidad lógica anterior se valida en lectura y generación; duplicados fallan con `COMMUNICATION_DUPLICATE_LOGICAL_KEY`.
- `DESTINATARIO` debe ser email válido e `INTENTOS` entero mayor o igual a cero.
- Ausencias generan texto neutral; no etiquetan una falta como injustificada antes de resolverla.
- Convocatorias sólo se generan para `APROBADA` y alumnos seleccionados.
- No hay confirmación de padres ni links de confirmación.
- El dominio usa adapter `send(message)`; no llama MailApp/GmailApp directamente.
- El adapter de Apps Script resuelve `MailApp`/`GmailApp` de forma lazy; construir runtime no envía ni consulta proveedor real.
- Antes de enviar, `CONFIG` vuelve a autorizar el tipo: `AVISO_AUSENCIA_EMAIL` para ausencias y `CONVOCATORIA_EMAIL` para convocatorias.
- Si la config deshabilita el tipo, el mensaje conserva su estado real y no se invoca el adapter.
- Antes de llamar el provider se persiste `ESTADO = ERROR`, `ERROR = DELIVERY_ATTEMPT_IN_PROGRESS` e `INTENTOS += 1`.
- Si el provider falla, se guarda error sanitizado como retry explícito.
- Si el provider tuvo éxito pero no se puede persistir `ENVIADO`, el comando falla con `COMMUNICATION_DELIVERY_STATE_UNCERTAIN`; ese marker bloquea auto-retry y retry normal.
- Errores de envío se sanitizan antes de persistir.
- `ASISTENCIAS.COMUNICACION_ID` es puntero resumen legacy; la relación canónica es `COMUNICACIONES.REFERENCIA_ID`.
- Si el correo se entrega y falla la actualización del puntero resumen, la comunicación queda `ENVIADO` con warning `COMMUNICATION_SUMMARY_POINTER_FAILED`; no se convierte en `ERROR` para evitar reenvío duplicado.

No se garantiza exactly-once delivery por infraestructura externa. La protección local evita duplicar mensajes por reintentos de fallos posteriores a una entrega marcada como enviada.
