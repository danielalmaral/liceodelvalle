# Decisions

## ADR-001: Repositorio Unico

El trabajo se limita a `danielalmaral/liceodelvalle` en `C:\Users\danie\liceodelvalle`.

## ADR-002: Bootstrap Directo en Main

Como el repositorio remoto inicia vacío, el commit inicial de bootstrap se realiza directamente sobre `main`. Las fases posteriores deberán usar ramas específicas.

## ADR-003: Apps Script Standalone

El piloto se prepara para Google Apps Script standalone con runtime V8 y futura integración con `clasp`.

## ADR-004: Config como Autoridad Operativa

Las reglas configurables vivirán en `CONFIG`, no hardcodeadas en código Apps Script.

## ADR-005: Autoridad Humana

El sistema podrá recomendar, pero la convocatoria final requerirá aprobación del entrenador.

## ADR-006: CONFIG Fail-Closed

Las claves runtime configurables deben resolverse desde `CONFIG`. Si una clave requerida falta, está duplicada, inactiva o no cumple su tipo, el sistema falla con errores canónicos en lugar de aplicar defaults ocultos.

## ADR-007: Schema Sin Valores Runtime

`ConfigSchema` documenta claves admitidas, grupos, tipos, obligatoriedad, unidades y validaciones estructurales. Los valores acordados viven en documentación o cargas explícitas, no como fallback productivo.

## ADR-008: Snapshot Historico Futuro

Las fases futuras que apliquen reglas de `CONFIG` a eventos históricos deberán conservar el valor aplicado en el momento del evento para evitar recálculos retroactivos no autorizados.

## ADR-009: Avisos Como Intent

La ausencia puede preparar intents de comunicación para tutores elegibles, pero no envía correo ni persiste comunicaciones en P4.

## ADR-010: Cumplimiento vs Presencia

Cumplimiento usa snapshots de valor aplicado sobre valor máximo aplicado. Presencia física mide sólo asistencia real `A` y `R`.

## ADR-011: FI Inmutable Con Evidencia En Detalle

Una `FI` pendiente bloquea exactamente una convocatoria y se considera consumida sólo por evidencia en `CONVOCATORIA_DETALLE` de una convocatoria aprobada o posterior, con partido no cancelado. `ASISTENCIAS` permanece como historial inmutable.

## ADR-012: Rotacion Por Competencia

La deuda de rotación se calcula por alumno y competencia usando únicamente convocatorias aprobadas, enviadas o cerradas de partidos no cancelados. Borradores y propuestas no alteran historia.

## ADR-013: Convocatoria Con Aprobacion Humana

El motor puede recomendar una propuesta determinista, pero sólo `approveConvocation` con actor puede aprobar. La aprobación valida total exacto, mínimos, elegibilidad, pendientes, cambios manuales, excepciones de rotación y partido no cancelado antes de escribir.

## ADR-014: Participacion No Crea Autoridad De Asistencia

`PARTICIPACION_PARTIDO` almacena estadística y snapshot operativo, pero el estado de asistencia se toma de `ASISTENCIAS` asociada a la sesión de partido.

## ADR-015: Comunicaciones Persistidas 1:N

Cada tutor elegible recibe una comunicación independiente. `COMUNICACIONES.REFERENCIA_ID` es la relación canónica; `ASISTENCIAS.COMUNICACION_ID` es sólo resumen legacy.

## ADR-016: Bitacora Append-Only Y Sanitizada

La bitácora registra eventos autoritativos sin exponer correos, teléfonos, cuerpos completos ni detalles médicos. Sheets no promete ACID; si el append falla después del write principal se reporta reconciliación requerida.

## ADR-017: Runtime Con Adapters Y Lock Inyectado

El runtime de Apps Script se compone desde adapters explícitos, Script Properties y locks inyectados. Tests usan fakes y no ejecutan servicios externos reales.
