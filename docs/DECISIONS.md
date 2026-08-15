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
