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
