# Rotation Contract

## Deuda

La rotacion mide partidos consecutivos en los que un alumno fue elegible y no quedo seleccionado finalmente. El contador es por alumno y competencia.

Estado inicial: `0`.

## Actualizacion

`ELIGIBLE` + seleccionado final reinicia deuda a `0`.

`ELIGIBLE` + no seleccionado incrementa en `1`.

`PENDING` o `INELIGIBLE` conserva la deuda anterior.

Convocatorias de partidos cancelados, borradores y propuestas no alteran rotacion.

## Prioridad

`ROTACION_OBLIGATORIA` y `MAX_SIN_CONVOCATORIA` se leen desde `CONFIG`. Si la deuda alcanza el umbral y el alumno es elegible, `PRIORIDAD_ROTACION = true`.

Si un alumno con prioridad queda fuera de la convocatoria aprobada, se requiere `ROTATION_EXCEPTION = true` y `MOTIVO_CAMBIO`. La excepcion no elimina la deuda.
