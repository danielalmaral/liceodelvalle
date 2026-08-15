# Architecture

## Separación de Responsabilidades

- GitHub: código fuente, documentación y validaciones.
- `CONFIG`: reglas operativas configurables.
- Google Sheet: datos operativos del piloto.
- Script Properties: secretos e IDs de entorno.
- Entrenador: autoridad de decisión final para convocatorias.

## Apps Script

El proyecto se prepara como Google Apps Script standalone con runtime V8, desarrollo modular y futura integración con `clasp`.

## Capas

- `config`: acceso a configuración sin fijar reglas operativas en código.
- `domain`: puntos de entrada para reglas de negocio futuras.
- `services`: coordinación de casos de uso futuros.
- `repositories`: acceso futuro a datos y configuración.
- `triggers`: handlers futuros para eventos autorizados.

## Config Authority

`CONFIG` es la autoridad runtime de reglas operativas configurables. `src/config/ConfigSchema.js` define claves, grupos, tipos, obligatoriedad y validaciones estructurales, pero no contiene valores runtime.

`ConfigService` falla de forma cerrada cuando falta una clave, aparece duplicada, está inactiva, no pertenece al schema o no cumple su tipo. No existen defaults operativos ocultos en código productivo.

## Setup de CONFIG

`ConfigSetup` prepara encabezados de la hoja `CONFIG` mediante un spreadsheet/adaptador recibido explícitamente. Es idempotente, no usa IDs reales y no destruye datos existentes.

## P2-P5 Foundation

Los módulos de alumnos, tutores, sesiones, asistencias, resolución de faltas y métricas son servicios puros con repositories/adapters inyectados. Las operaciones temporales aceptan reloj inyectable y los envíos de correo quedan como intents sin entrega real.

Los snapshots `VALOR_APLICADO`, `VALOR_MAXIMO_APLICADO` y `LIMITE_JUSTIFICACION` preservan valores históricos aunque `CONFIG` cambie posteriormente.

## P6-P9 Competition

`MatchService`, `EligibilityService`, `RotationService` y `ConvocationService` mantienen la lógica competitiva en servicios puros con repositories, reloj e IDs inyectables. `CONFIG` sigue siendo autoridad runtime para cupos, mínimos y rotación.

La propuesta de convocatoria no consume FI, no actualiza rotación y no envía comunicaciones. Sólo una aprobación humana explícita persiste `APROBADA`, detalles finales y `ROTACION_DESPUES`.

Los módulos en `src/` conservan compatibilidad directa con Apps Script V8: no dependen de `require`, `import` ni `export` en runtime productivo.
