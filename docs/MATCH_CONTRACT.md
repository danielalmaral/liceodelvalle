# Match Contract

## PARTIDOS

Columnas: `PARTIDO_ID`, `COMPETENCIA`, `JORNADA`, `RIVAL`, `FECHA`, `HORA_CITACION`, `HORA_PARTIDO`, `SEDE`, `LOCAL_VISITANTE`, `DURACION_MINUTOS`, `UNIFORME`, `INDICACIONES`, `ESTADO`, `GOLES_FAVOR`, `GOLES_CONTRA`, `OBSERVACIONES`.

`PARTIDO_ID` es obligatorio, unico y estable. `COMPETENCIA` acepta `A` o `B`. `ESTADO` acepta `PROGRAMADO`, `JUGADO` o `CANCELADO`.

Cuando `ESTADO = JUGADO`, `GOLES_FAVOR` y `GOLES_CONTRA` deben ser enteros no negativos. `HORA_CITACION` no puede ser posterior a `HORA_PARTIDO`, y `DURACION_MINUTOS` debe ser entero positivo.

## SESIONES

Para `TIPO = PARTIDO`, `PARTIDO_ID` es obligatorio, debe existir y debe coincidir con la competencia del partido. Para `TIPO = ENTRENAMIENTO`, `PARTIDO_ID` debe permanecer vacio.

Una sesion historica puede referenciar un partido cancelado. No se exige que cada partido tenga una sesion en P6.
