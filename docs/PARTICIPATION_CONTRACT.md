# Participation Contract

`PARTICIPACION_PARTIDO` registra estadísticas post-partido para alumnos finalmente convocados.

Columnas: `PARTICIPACION_ID`, `PARTIDO_ID`, `ALUMNO_ID`, `CONVOCATORIA_ID`, `ASISTIO`, `ASISTENCIA_ESTADO`, `CONDICION_INICIAL`, `MINUTOS_JUGADOS`, `GOLES`, `AMARILLAS`, `ROJAS`, `CALIFICACION`, `OBSERVACIONES`, `REGISTRADO_EN`, `MODIFICADO_EN`.

Reglas principales:

- `PARTICIPACION_ID` es estable y no deriva de row number.
- `PARTIDO_ID`, `CONVOCATORIA_ID` y `ALUMNO_ID` deben existir.
- La convocatoria debe estar `APROBADA`, `ENVIADA` o `CERRADA`, pertenecer al partido y tener al alumno seleccionado.
- `ASISTIO` usa booleanos estrictos.
- `ASISTENCIA_ESTADO` debe coincidir con `ASISTENCIAS` de la sesión de partido.
- Estados presentes `A` y `R` requieren `ASISTIO = true`; estados ausentes `F`, `FJ`, `FI` y `LES` requieren `ASISTIO = false`.
- `MINUTOS_JUGADOS`, goles y tarjetas son enteros no negativos.
- Un alumno ausente debe conservar minutos, goles y tarjetas en cero y calificación vacía.
- `ROJAS` permite máximo 1 y genera `RED_CARD_REVIEW_REQUIRED` cuando la config lo requiere.
- Calificación usa escala y decimales desde `CONFIG`.
- Readiness de partido programado falla con `MATCH_NOT_PLAYED`; no autoriza cierre de estadísticas antes de `JUGADO`.
- `LOW_PARTICIPATION_STREAK` se calcula cronológicamente por competencia sobre convocatorias autoritativas, aprobadas o posteriores, donde el alumno fue seleccionado final. Participaciones con minutos positivos cortan la racha; partidos no seleccionados, cancelados o de otra competencia no fabrican ceros.
