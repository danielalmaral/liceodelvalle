# Liceo del Valle Football Pilot

Bootstrap técnico para el piloto de fútbol del Liceo del Valle.

Este repositorio contiene código y documentación base para una futura solución ligera en Google Apps Script standalone, con desarrollo modular y preparación para `clasp`.

## Estado

Fase actual: `LDV-PILOT-P0-BOOTSTRAP-01`

P0 establece estructura, reglas de trabajo, documentación y validaciones iniciales. No implementa lógica funcional de convocatoria, asistencia, elegibilidad, rotación ni comunicaciones.

P1 agrega la infraestructura canónica de configuración dinámica. `CONFIG` es la única fuente runtime para reglas operativas configurables; si una clave requerida falta, el sistema falla de forma explícita sin usar defaults ocultos.

El safe batch P2-P5 agrega cimientos de alumnos, tutores, sesiones, asistencias, resolución de faltas y métricas. No crea recursos Google reales, no envía correos y no implementa convocatoria.

El safe batch P6-P9 agrega partidos, elegibilidad, rotación y motor determinista de convocatoria hasta aprobación humana. No envía correos, no crea recursos Google reales y no implementa participación ni estadísticas de partido.

El safe batch P10-P13 agrega participación post-partido, comunicaciones persistidas, bitácora append-only y runtime/repository para Google Sheets con adapters fake en tests. No instala triggers, no envía correos reales, no crea Spreadsheet real y no implementa panel.

P14 agrega la superficie operativa del piloto: comandos para sesiones, partidos y estado deportivo, panel Apps Script como UI de lectura/acciones, adapters reales lazy para Apps Script, hoja `PANEL` como landing no autoritativa y un smoke harness local con fakes. No ejecuta Google real, no hace `clasp push`, no instala triggers y no envía correo real.

## Contratos

- `docs/MATCH_CONTRACT.md`: `PARTIDOS` y FK `SESIONES.PARTIDO_ID`.
- `docs/ELIGIBILITY_CONTRACT.md`: elegibilidad por partido, `PENDING` y consumo canónico de FI.
- `docs/ROTATION_CONTRACT.md`: deuda por competencia y excepciones humanas.
- `docs/CONVOCATION_CONTRACT.md`: propuesta, revisión y aprobación humana de convocatorias.
- `docs/PARTICIPATION_CONTRACT.md`: participación por partido y estadísticas.
- `docs/COMMUNICATION_CONTRACT.md`: comunicaciones persistidas, adapter de correo e idempotencia.
- `docs/AUDIT_CONTRACT.md`: bitácora append-only y privacidad.
- `docs/SHEET_RUNTIME_CONTRACT.md`: repositorio de hojas, runtime, locks y triggers diferidos.
- `docs/PANEL_CONTRACT.md`: query model, UI y frontera de comandos del panel.
- `docs/APPS_SCRIPT_BOOTSTRAP_CONTRACT.md`: adapters lazy y bootstrap real diferido.
- `docs/P14_OPERATIONAL_WORKFLOW.md`: flujo operativo piloto con fakes.
- `docs/REAL_GOOGLE_SMOKE_RUNBOOK.md`: runbook de P15 para smoke real controlado.

## Comandos

```bash
npm test
npm run validate
npm run security:scan
```
