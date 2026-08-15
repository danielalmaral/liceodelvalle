# P14 Operational Workflow

P14 habilita operacion diaria con datos ficticios y fakes locales. El panel certificado para la siguiente fase es una sidebar HtmlService container-bound al Spreadsheet.

## Flujo Cubierto

1. Crear o validar 12 hojas.
2. Cargar CONFIG ficticio.
3. Cargar alumnos y tutores ficticios.
4. Crear sesion de entrenamiento.
5. Registrar asistencia `A`, `R` o `F`.
6. Resolver una falta autorizada.
7. Crear partido.
8. Crear sesion tipo partido.
9. Registrar asistencia de partido.
10. Generar convocatoria.
11. Aplicar cambio manual con motivo.
12. Aprobar convocatoria.
13. Preparar comunicaciones.
14. Simular envio con fake adapter.
15. Marcar partido jugado.
16. Registrar participacion.
17. Consultar dashboard.
18. Validar bitacora.
19. Confirmar que no se expone PII tecnica.
20. Reejecutar operaciones idempotentes criticas.

## Limites

No usa datos reales, Spreadsheet real, `clasp push`, MailApp real ni triggers productivos. El correo externo permanece deshabilitado. P15 debera crear un Spreadsheet ficticio y ligar el Apps Script a ese contenedor antes de ejecutar el smoke controlado.
