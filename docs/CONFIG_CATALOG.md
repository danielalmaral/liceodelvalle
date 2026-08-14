# Config Catalog

`CONFIG` es la fuente de verdad runtime para reglas operativas configurables. El código productivo no debe contener defaults ocultos para estas reglas: si falta una clave requerida, el sistema debe fallar con un error explícito.

## Hoja CONFIG

Columnas canónicas:

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

## Tipos

- `INTEGER`: entero estricto.
- `DECIMAL`: número decimal o entero.
- `BOOLEAN`: acepta `true`, `false`, `TRUE`, `FALSE`, `SI`, `NO`.
- `STRING`: texto.
- `ENUM`: texto restringible por schema futuro.

## Catalogo Inicial

| Grupo | Clave | Tipo | Unidad | Valor inicial acordado |
| --- | --- | --- | --- | --- |
| GENERAL | TEMPORADA | STRING |  | Por definir en inicialización |
| CONVOCATORIA | CONVOCADOS_A | INTEGER | jugadores | 18 |
| CONVOCATORIA | CONVOCADOS_B | INTEGER | jugadores | 18 |
| CONVOCATORIA | CONFIRMACION_PADRES | BOOLEAN |  | false |
| ASISTENCIA | ASISTENCIA_VALOR | DECIMAL | puntos | 1 |
| ASISTENCIA | RETARDO_VALOR | DECIMAL | puntos | 0.75 |
| ASISTENCIA | FALTA_INJUSTIFICADA_VALOR | DECIMAL | puntos | 0 |
| ASISTENCIA | FALTA_JUSTIFICADA_VALOR | DECIMAL | puntos | 1 |
| ASISTENCIA | LESION_VALOR | DECIMAL | puntos | 1 |
| ASISTENCIA | HORAS_JUSTIFICACION | INTEGER | horas | 24 |
| ROTACION | ROTACION_OBLIGATORIA | BOOLEAN |  | true |
| ROTACION | MAX_SIN_CONVOCATORIA | INTEGER | partidos | 1 |
| POSICIONES | MIN_PORTEROS | INTEGER | jugadores | 1 |
| POSICIONES | MIN_DEFENSAS | INTEGER | jugadores | 4 |
| POSICIONES | MIN_MEDIOS | INTEGER | jugadores | 4 |
| POSICIONES | MIN_DELANTEROS | INTEGER | jugadores | 3 |
| RENDIMIENTO | ESCALA_CALIFICACION_MIN | INTEGER | estrellas | 1 |
| RENDIMIENTO | ESCALA_CALIFICACION_MAX | INTEGER | estrellas | 5 |
| RENDIMIENTO | CALIFICACION_DECIMALES | BOOLEAN |  | false |
| RENDIMIENTO | CONTROL_MINUTOS_A | BOOLEAN |  | true |
| RENDIMIENTO | CONTROL_MINUTOS_B | BOOLEAN |  | true |
| RENDIMIENTO | ALERTA_SUPLENCIAS_CONSECUTIVAS | INTEGER | partidos | 3 |
| DISCIPLINA | ROJA_BLOQUEA_CONVOCATORIA | BOOLEAN |  | true |
| COMUNICACION | AVISO_AUSENCIA_EMAIL | BOOLEAN |  | true |
| COMUNICACION | CONVOCATORIA_EMAIL | BOOLEAN |  | true |

Los valores iniciales son documentación funcional y deben cargarse mediante una operación explícita y auditable. No son defaults runtime.

## Fail Closed

`CONFIG missing` significa error, no fallback. Ejemplo esperado:

```text
CONFIG_REQUIRED_KEY_MISSING: CONVOCADOS_A
```

## Snapshot Historico

Cuando una regla de `CONFIG` afecte un evento histórico relevante, las fases futuras deberán guardar el valor aplicado como snapshot. Si `RETARDO_VALOR` cambia después, una asistencia pasada conservará el valor aplicado originalmente.
