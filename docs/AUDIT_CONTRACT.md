# Audit Contract

`BITACORA` registra eventos append-only de cambios autoritativos.

Columnas: `EVENTO_ID`, `FECHA_HORA`, `USUARIO`, `ENTIDAD`, `ENTIDAD_ID`, `ACCION`, `CAMPO`, `VALOR_ANTERIOR`, `VALOR_NUEVO`, `MOTIVO`.

Eventos cubiertos:

- Transiciones de ausencia `F` hacia `FJ`, `FI` o `LES`.
- Cambios manuales de convocatoria.
- Aprobación de convocatoria.
- Actualización de participación.
- Cambios de estado de comunicación.

Autoridad de escritura:

- Las escrituras operativas que deben auditarse se ejecutan mediante `OperationalCommandService`.
- El comando valida y escribe el dominio primero; si esa escritura falla, no se agrega evento.
- Si el append de auditoría falla después del write de dominio, el comando falla con `AUDIT_PERSISTENCE_FAILED_AFTER_WRITE` para reconciliación explícita.
- `EVENTO_ID` incorpora un `operationId` inyectable. Reintentar la misma operación conserva idempotencia; operaciones distintas sobre la misma entidad/campo producen eventos distintos.

Privacidad:

- No guardar correos, teléfonos, cuerpos completos ni detalles médicos.
- Los valores libres se sanitizan.

Sheets no ofrece transacciones SQL ni garantías ACID. La bitácora es append-only y no reemplaza controles de reconciliación operacional.
