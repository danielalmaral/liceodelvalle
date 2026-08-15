# Data Model

P0 documenta las entidades previstas sin crear hojas reales.

## Hojas Previstas

1. `PANEL`
2. `CONFIG`
3. `ALUMNOS`
4. `TUTORES`
5. `SESIONES`
6. `ASISTENCIAS`
7. `PARTIDOS`
8. `CONVOCATORIAS`
9. `CONVOCATORIA_DETALLE`
10. `PARTICIPACION_PARTIDO`
11. `COMUNICACIONES`
12. `BITACORA`

## Nota

La definición detallada de columnas, tipos, validaciones y reglas de integridad corresponde a fases posteriores autorizadas.

## CONFIG

`CONFIG` queda formalizada desde P1 con estas columnas:

```text
CONFIG_ID
GRUPO
CLAVE
VALOR
TIPO
UNIDAD
ACTIVO
DESCRIPCION
MODIFICADO_EN
MODIFICADO_POR
```

La hoja no se crea contra un Spreadsheet real en P1. Sólo se define el contrato y una rutina idempotente de setup para uso futuro.

## ASISTENCIAS

`ASISTENCIAS` incluye `VALOR_MAXIMO_APLICADO` como snapshot histórico del máximo posible al momento del evento. El estado `F` es pendiente y no tiene puntaje hasta resolverse en `FJ`, `LES` o `FI`.

## COMUNICACIONES

P4 sólo prepara intents de aviso de ausencia. La persistencia de `COMUNICACIONES` y el envío real permanecen diferidos.

## PARTIDOS

`PARTIDOS` queda materializada con `PARTIDO_ID` estable, competencia `A`/`B`, datos de jornada, rival, horarios, sede, duración, estado y marcador cuando el partido fue jugado.

`SESIONES.PARTIDO_ID` se valida para sesiones tipo `PARTIDO`; entrenamientos deben mantenerlo vacío.

## CONVOCATORIAS

`CONVOCATORIAS` guarda snapshots de cupo total, mínimos por posición y rotación al momento de generar la propuesta.

`CONVOCATORIA_DETALLE` guarda una fila por alumno evaluado del pool: elegibilidad, FI fuente, snapshots deportivos, rotación antes/después, recomendación del sistema, selección final, cambios manuales y posición asignada.

`PARTICIPACION_PARTIDO`, `COMUNICACIONES` persistidas, `BITACORA` real y `PANEL` permanecen diferidos.
