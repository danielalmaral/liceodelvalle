# Safe Batch P6-P9 Report

Este batch implementa fundamentos competitivos en la rama `safe-batch/p6-p9-competition-01`.

## Alcance

- P6: `PARTIDOS` y validacion de `SESIONES.PARTIDO_ID`.
- P7: motor canonico de elegibilidad por partido, incluyendo `PENDING` y FI pendiente.
- P8: rotacion por alumno y competencia con excepcion humana obligatoria.
- P9: propuesta determinista de convocatoria, detalle por alumno, revision manual y aprobacion humana hasta `APROBADA`.

## Diferidos

- Envio real de correo y persistencia de `COMUNICACIONES`.
- `PARTICIPACION_PARTIDO`, minutos, goles, tarjetas y estadisticas.
- `BITACORA` persistida, triggers productivos, Google Sheet real y `clasp push`.
- Consumo automatico de `ROJA_BLOQUEA_CONVOCATORIA` hasta existir participacion de partido.

## Garantias

`CONFIG` sigue siendo autoridad runtime. No se agregan claves de configuracion. Las propuestas no consumen FI ni actualizan rotacion; solo la aprobacion humana crea historia.
