# Attendance Contract

## SESIONES

`SESIONES` define entrenamientos o partidos con estado `ABIERTA` o `CERRADA`. `PARTIDO_ID` queda con validación diferida hasta la fase de partidos.

## ASISTENCIAS

Estados: `A`, `R`, `F`, `FJ`, `FI`, `LES`.

La captura normal acepta `A`, `R` y `F`. Una `F` representa falta pendiente y no aplica puntaje hasta resolverse.

## Snapshots

`VALOR_APLICADO` y `VALOR_MAXIMO_APLICADO` guardan los valores vigentes al momento de captura o resolución. No se recalculan si `CONFIG` cambia.

`LIMITE_JUSTIFICACION` se calcula con `HORAS_JUSTIFICACION` al registrar `F` y queda histórico.

## Resolucion De Faltas

Dentro de la ventana, `F` puede resolverse a `FJ` o `LES`. Fuera de ventana queda `FI`. La expiración es idempotente y no requiere trigger productivo en este batch.

## Avisos

Los avisos de ausencia son intents sin envío real. `AVISO_ENVIADO` permanece falso y `COMUNICACION_ID` vacío hasta una fase futura.

## Metricas

Cumplimiento = `SUM(VALOR_APLICADO) / SUM(VALOR_MAXIMO_APLICADO) * 100`.

Presencia física = registros `A + R` sobre total de asistencias.

Las faltas pendientes se excluyen de cumplimiento y marcan el resultado como `PROVISIONAL`.
