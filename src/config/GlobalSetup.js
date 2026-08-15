function setupOperationalSheets(spreadsheet, setupFn) {
  setupFn(spreadsheet, 'CONFIG', CONFIG_HEADERS);
  setupFn(spreadsheet, 'ALUMNOS', STUDENT_HEADERS);
  setupFn(spreadsheet, 'TUTORES', TUTOR_HEADERS);
  setupFn(spreadsheet, 'SESIONES', SESSION_HEADERS);
  setupFn(spreadsheet, 'ASISTENCIAS', ATTENDANCE_HEADERS);
  setupFn(spreadsheet, 'PARTIDOS', MATCH_HEADERS);
  setupFn(spreadsheet, 'CONVOCATORIAS', CONVOCATION_HEADERS);
  setupFn(spreadsheet, 'CONVOCATORIA_DETALLE', CONVOCATION_DETAIL_HEADERS);
  setupFn(spreadsheet, 'PARTICIPACION_PARTIDO', PARTICIPATION_HEADERS);
  setupFn(spreadsheet, 'COMUNICACIONES', COMMUNICATION_HEADERS);
  setupFn(spreadsheet, 'BITACORA', AUDIT_HEADERS);
  return { sheetCount: 11 };
}

if (typeof module !== 'undefined') {
  module.exports = { setupOperationalSheets };
}
