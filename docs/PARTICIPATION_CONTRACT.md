# Participation Contract

`PARTICIPACION_PARTIDO` registra estadísticas post-partido para alumnos finalmente convocados.

Columnas: `PARTICIPACION_ID`, `PARTIDO_ID`, `ALUMNO_ID`, `CONVOCATORIA_ID`, `ASISTIO`, `ASISTENCIA_ESTADO`, `CONDICION_INICIAL`, `MINUTOS_JUGADOS`, `GOLES`, `AMARILLAS`, `ROJAS`, `CALIFICACION`, `OBSERVACIONES`, `REGISTRADO_EN`, `MODIFICADO_EN`.

Reglas principales:

- `PARTICIPACION_ID` es estable y no deriva de row number.
- `PARTIDO_ID`, `CONVOCATORIA_ID` y `ALUMNO_ID` deben existir.
- La convocatoria debe estar `APROBADA`, `ENVIADA` o `CERRADA`, pertenecer al partido y tener al alumno seleccionado.
- `ASISTIO` usa booleanos estrictos.
- `ASISTENCIA_ESTADO` debe coincidir con `ASISTENCIAS` de la sesión de partido.
- `MINUTOS_JUGADOS`, goles y tarjetas son enteros no negativos.
- `ROJAS` permite máximo 1 y genera `RED_CARD_REVIEW_REQUIRED` cuando la config lo requiere.
- Calificación usa escala y decimales desde `CONFIG`.
- Readiness detecta faltantes, no convocados, inconsistencias y `LOW_PARTICIPATION_STREAK` con cero minutos consecutivos.
