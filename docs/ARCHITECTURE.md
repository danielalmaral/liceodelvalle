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
