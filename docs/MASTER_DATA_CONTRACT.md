# Master Data Contract

## ALUMNOS

Columnas: `ALUMNO_ID`, `ACTIVO`, `NOMBRE`, `APELLIDOS`, `GRADO`, `GRUPO`, `COMPETENCIA_BASE`, `NIVEL`, `POSICION_PRINCIPAL`, `POSICION_SECUNDARIA`, `FECHA_ALTA`, `FECHA_BAJA`, `ESTADO_DEPORTIVO`, `OBSERVACIONES`.

`ALUMNO_ID` es estable y único. `ACTIVO` es boolean estricto. `COMPETENCIA_BASE`, `NIVEL`, posiciones y estado deportivo usan catálogos estructurales definidos sin reglas de elegibilidad.

## TUTORES

Columnas: `TUTOR_ID`, `ALUMNO_ID`, `NOMBRE_TUTOR`, `PARENTESCO`, `EMAIL`, `TELEFONO`, `PRINCIPAL`, `RECIBE_AUSENCIAS`, `RECIBE_CONVOCATORIAS`, `ACTIVO`.

`TUTOR_ID` es único y `ALUMNO_ID` referencia a un alumno existente. Puede haber varios tutores por alumno, pero máximo un tutor activo principal. El email no es único global.

## Communication Readiness

La preparación para ausencias y convocatorias se reporta explícitamente. No bloquea la creación de alumnos o tutores incompletos.
