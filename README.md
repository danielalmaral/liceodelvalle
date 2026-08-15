# Liceo del Valle Football Pilot

Bootstrap técnico para el piloto de fútbol del Liceo del Valle.

Este repositorio contiene código y documentación base para una futura solución ligera en Google Apps Script standalone, con desarrollo modular y preparación para `clasp`.

## Estado

Fase actual: `LDV-PILOT-P0-BOOTSTRAP-01`

P0 establece estructura, reglas de trabajo, documentación y validaciones iniciales. No implementa lógica funcional de convocatoria, asistencia, elegibilidad, rotación ni comunicaciones.

P1 agrega la infraestructura canónica de configuración dinámica. `CONFIG` es la única fuente runtime para reglas operativas configurables; si una clave requerida falta, el sistema falla de forma explícita sin usar defaults ocultos.

El safe batch P2-P5 agrega cimientos de alumnos, tutores, sesiones, asistencias, resolución de faltas y métricas. No crea recursos Google reales, no envía correos y no implementa convocatoria.

## Comandos

```bash
npm test
npm run validate
npm run security:scan
```
