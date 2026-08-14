# AGENTS.md

## 1. Repo Lock

La única repo autorizada para este proyecto es:

`danielalmaral/liceodelvalle`

Nunca trabajar fuera de ella, clonar otra repo, usar otro remote, inspeccionar otra repo como sustituto ni reutilizar código de otra repo sin autorización explícita del usuario.

## 2. No PII

Está prohibido introducir en Git:

- nombres reales de alumnos;
- correos reales de padres;
- teléfonos;
- información privada de menores;
- justificantes;
- expedientes;
- credenciales;
- IDs privados de entornos.

Fixtures y tests deberán utilizar exclusivamente datos ficticios.

## 3. Config Authority

Las reglas operativas configurables no pueden quedar hardcodeadas en Apps Script.

Ejemplos de valores que posteriormente deberán proceder de `CONFIG`:

- número de convocados;
- valor de asistencia;
- valor de retardo;
- valor de falta;
- valor de falta justificada;
- valor de lesión;
- horas para justificar;
- mínimos por posición;
- reglas de rotación;
- parámetros de calificación.

P0 no implementa estas reglas.

## 4. No Invented Business Rules

Codex no puede crear reglas deportivas o administrativas no autorizadas.

Ante una ambigüedad funcional debe reportarla, no resolverla inventando comportamiento.

## 5. Human Authority

El sistema podrá recomendar convocatorias.

La convocatoria definitiva requiere aprobación humana del entrenador.

## 6. Main Governance

Por tratarse de una repo completamente vacía, se autoriza exclusivamente el commit inicial de bootstrap directamente sobre `main`.

Después del bootstrap queda prohibido implementar fases funcionales directamente sobre `main`.

Las siguientes fases deberán usar ramas específicas.
