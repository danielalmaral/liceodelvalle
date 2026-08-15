# Audit Contract

`BITACORA` registra eventos append-only de cambios autoritativos.

Columnas: `EVENTO_ID`, `FECHA_HORA`, `USUARIO`, `ENTIDAD`, `ENTIDAD_ID`, `ACCION`, `CAMPO`, `VALOR_ANTERIOR`, `VALOR_NUEVO`, `MOTIVO`.

Eventos cubiertos:

- Transiciones de ausencia `F` hacia `FJ`, `FI` o `LES`.
- Cambios manuales de convocatoria.
- Aprobación de convocatoria.
- Actualización de participación.
- Cambios de estado de comunicación.

Privacidad:

- No guardar correos, teléfonos, cuerpos completos ni detalles médicos.
- Los valores libres se sanitizan.

Sheets no ofrece transacciones SQL. La estrategia es validar antes, escribir dominio, append audit y reportar `AUDIT_PERSISTENCE_FAILED_AFTER_WRITE` si el append falla después del write.
