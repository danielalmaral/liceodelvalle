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
- Cada comando auditado requiere `idGenerator.operationId`; un ID vacío o ausente falla cerrado.
- Antes de escribir dominio, el comando revisa evidencia existente para ese `operationId`.
- La evidencia durable incluye un evento tecnico `OPERACION/INTENT` con firma canonica de intencion; la decision de replay no depende del estado mutable posterior al primer write.
- Si la operación ya fue procesada con la misma intención, no se repite el write y se devuelve replay idempotente.
- Si el mismo `operationId` se reutiliza para otro payload, falla con `OPERATION_ID_CONFLICT` antes del write.
- El comando valida y escribe el dominio sólo cuando la operación es nueva; si esa escritura falla, no se agrega evento.
- Si el append de auditoría falla después del write de dominio, el comando falla con `AUDIT_PERSISTENCE_FAILED_AFTER_WRITE` para reconciliación explícita.
- `EVENTO_ID` incorpora `operationId` y entidad; operaciones batch usan ID de entidad, no índice de array.
- Operaciones sin cambio funcional tambien conservan firma de intencion para distinguir replay legitimo de reutilizacion indebida del `operationId`.
- `AuditService.appendEvent` permite replay sólo si el payload autoritativo coincide. Si el mismo `EVENTO_ID` trae otro payload, falla con `AUDIT_EVENT_ID_CONFLICT`.
- Actualizaciones de participación con múltiples campos crean un evento por campo realmente cambiado.

Privacidad:

- No guardar correos, teléfonos, cuerpos completos ni detalles médicos.
- Campos libres o sensibles conocidos se redactan como `[REDACTED]`.
- Motivos de ausencia en bitácora usan códigos técnicos seguros, no texto libre de justificación.

Sheets no ofrece transacciones SQL ni garantías ACID. La bitácora es append-only y no reemplaza controles de reconciliación operacional.
