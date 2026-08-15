# Eligibility Contract

## Estados

La elegibilidad por alumno y partido produce `ELIGIBLE`, `PENDING` o `INELIGIBLE`.

`PENDING` representa faltas `F` pendientes de resolucion. No es seleccionable automaticamente, no genera deuda de rotacion y no consume FI.

`INELIGIBLE` cubre alumno inactivo, lesion actual, suspension, fuera de pool o FI pendiente. Retardo, FJ y LES historica no bloquean por si solas.

## Pool

El pool sale de `ALUMNOS.COMPETENCIA_BASE` y se compara con `PARTIDOS.COMPETENCIA`. `NIVEL` no mueve jugadores entre A y B.

## FI

Cada asistencia `FI` produce un bloqueo pendiente. Se consume solamente si una convocatoria aprobada o posterior, con partido no cancelado, tiene un detalle del alumno con `ELEGIBILITY_STATUS = INELIGIBLE`, `MOTIVO_NO_ELEGIBLE = FI_BLOCK` y `FI_ORIGEN_ID` igual a esa `ASISTENCIA_ID`.

Las propuestas no consumen FI y `ASISTENCIAS` no se muta. Si hay varias FI pendientes, se usa primero la mas antigua con `ASISTENCIA_ID` como desempate.

## Snapshot

Cada evaluacion registra alumno, partido, competencia, estado, motivo, FI origen, metricas de asistencia, estado de metricas y timestamp.
