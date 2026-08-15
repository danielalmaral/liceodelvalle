# Convocation Contract

## CONVOCATORIAS

Columnas: `CONVOCATORIA_ID`, `PARTIDO_ID`, `COMPETENCIA`, `TOTAL_OBJETIVO`, `MIN_PORTEROS_SNAPSHOT`, `MIN_DEFENSAS_SNAPSHOT`, `MIN_MEDIOS_SNAPSHOT`, `MIN_DELANTEROS_SNAPSHOT`, `MAX_SIN_CONVOCATORIA_SNAPSHOT`, `ESTADO`, `GENERADA_EN`, `GENERADA_POR`, `APROBADA_EN`, `APROBADA_POR`, `ENVIADA_EN`, `TOTAL_SELECCIONADOS`, `TOTAL_ALERTAS`, `OBSERVACIONES`.

La generacion lee `CONVOCADOS_A` o `CONVOCADOS_B`, minimos por posicion y `MAX_SIN_CONVOCATORIA` desde `CONFIG`, y guarda snapshots. Falla cerrado si el total es invalido o los minimos exceden el total.

## CONVOCATORIA_DETALLE

Cada alumno evaluado del pool tiene una fila con elegibilidad, FI origen, snapshots de competencia, nivel, posiciones, asistencia, rotacion, seleccion recomendada, seleccion final, cambios manuales, excepcion y posicion asignada.

## Seleccion

El motor excluye `INELIGIBLE` y `PENDING`, prioriza rotacion obligatoria, cubre minimos por posicion y llena cupos flexibles. Un jugador cuenta una sola vez y puede cubrir posicion secundaria cuando sea necesario.

Liga A ordena por rotacion, nivel, asistencia conocida, menor historial y `ALUMNO_ID`. Liga B ordena por rotacion, menor historial, asistencia conocida, nivel y `ALUMNO_ID`. `NO_DATA` no se convierte en 0 ni 100.

## Conflictos

Si no hay suficientes elegibles o existe conflicto entre rotacion y estructura posicional, la convocatoria queda marcada para resolucion humana mediante alertas y observaciones.

## Aprobacion Humana

Solo una aprobacion con actor puede pasar a `APROBADA`. Antes de escribir valida total exacto, minimos, ningun `INELIGIBLE`, ningun `PENDING`, motivos de cambios manuales, excepciones de rotacion, IDs y partido no cancelado.

Si falla, no modifica estado, no consume FI y no actualiza rotacion.
